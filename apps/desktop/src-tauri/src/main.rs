#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use base64::Engine as _;
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::Manager;

struct Worker {
    child: Child,
    input: ChildStdin,
    output: mpsc::Receiver<String>,
}
impl Worker {
    fn start(library: PathBuf, recovery: PathBuf) -> Result<Self, String> {
        let mut command = Command::new(std::env::current_exe().map_err(|e| e.to_string())?);
        command
            .arg("--pdf-worker")
            .arg(library)
            .arg(recovery)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command.spawn().map_err(|e| e.to_string())?;
        let input = child.stdin.take().ok_or("Worker input unavailable")?;
        let output = child.stdout.take().ok_or("Worker output unavailable")?;
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(output).lines() {
                match line {
                    Ok(line) => {
                        if tx.send(line).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
        Ok(Self {
            child,
            input,
            output: rx,
        })
    }
    fn call(&mut self, request: Value) -> Result<Value, String> {
        writeln!(self.input, "{}", request).map_err(|_| {
            "The PDF worker stopped. Reopen the application to recover your last edit.".to_owned()
        })?;
        self.input.flush().map_err(|e| e.to_string())?;
        let line=self.output.recv_timeout(Duration::from_secs(60)).map_err(|_|{let _=self.child.kill();"The operation exceeded its safety limit or the PDF worker stopped. The source file was not modified. Restart to recover the last edit.".to_owned()})?;
        let response: Value = serde_json::from_str(&line).map_err(|e| e.to_string())?;
        if response["ok"] == true {
            Ok(response["value"].clone())
        } else {
            Err(response["error"]
                .as_str()
                .unwrap_or("The operation failed. The source file was not modified.")
                .to_owned())
        }
    }
}
impl Drop for Worker {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}
struct Backend(Mutex<Worker>);
fn call(state: &Backend, request: Value) -> Result<Value, String> {
    state
        .0
        .lock()
        .map_err(|_| "Document service unavailable".to_owned())?
        .call(request)
}
#[tauri::command]
async fn api(
    app: tauri::AppHandle,
    action: String,
    id: Option<String>,
    payload: Option<Value>,
) -> Result<Value, String> {
    if ![
        "import",
        "create",
        "view",
        "render",
        "inspect",
        "object_layers",
        "text",
        "export",
        "export_text",
        "extract",
        "edit",
        "edit_batch",
        "undo",
        "redo",
        "merge",
        "insert_pdf",
        "copy_object",
        "paste_object",
        "compare",
        "protect",
        "close",
        "recovery_list",
        "recover",
        "redact",
        "validate",
        "repair",
        "optimize",
        "sessions",
        "validate_signatures",
        "recent_list",
        "recent_open",
        "recent_duplicate",
        "recent_pin",
        "recent_remove",
    ]
    .contains(&action.as_str())
    {
        return Err("This action is not permitted from the document interface.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        call(
            &app.state::<Backend>(),
            json!({"action":action,"id":id,"payload":payload}),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn open_document(app: tauri::AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("PDF document", &["pdf"])
            .pick_file()
        else {
            return Ok(Value::Null);
        };
        call(
            &app.state::<Backend>(),
            json!({"action":"open","payload":{"path":path}}),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn open_dropped(app: tauri::AppHandle, paths: Vec<PathBuf>) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if paths.len() > 30 {
            return Err("Open at most 30 dropped documents together.".into());
        }
        let mut out = Vec::new();
        for path in paths {
            if path
                .extension()
                .is_some_and(|s| s.eq_ignore_ascii_case("pdf"))
            {
                out.push(call(
                    &app.state::<Backend>(),
                    json!({"action":"open","payload":{"path":path}}),
                )?);
            }
        }
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn save_document(
    app: tauri::AppHandle,
    id: String,
    mode: String,
    filename: Option<String>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Backend>();
        let view = call(&state, json!({"action":"view","id":id}))?;
        let path = if mode == "save" {
            view["source"].as_str().map(PathBuf::from)
        } else {
            None
        };
        let path = path.or_else(|| {
            rfd::FileDialog::new()
                .add_filter("PDF document", &["pdf"])
                .set_file_name(
                    filename
                        .as_deref()
                        .and_then(|s| std::path::Path::new(s).file_name())
                        .and_then(|s| s.to_str())
                        .unwrap_or(view["name"].as_str().unwrap_or("Document.pdf")),
                )
                .save_file()
        });
        let Some(path) = path else {
            return Ok(Value::Null);
        };
        call(
            &state,
            json!({"action":"save","id":id,"payload":{"path":path,"copy":mode=="copy"}}),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn digital_sign(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let prepared = call(
            &app.state::<Backend>(),
            json!({"action":"prepare_signature","id":id}),
        )?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(prepared.as_str().ok_or("Invalid signing data")?)
            .map_err(|e| e.to_string())?;
        #[cfg(windows)]
        let signed =
            pdf_core::signatures::sign_with_windows_store(&bytes).map_err(|e| e.to_string())?;
        #[cfg(not(windows))]
        return Err("Certificate signing currently requires Windows.".into());
        #[cfg(windows)]
        {
            let Some(path) = rfd::FileDialog::new()
                .add_filter("Signed PDF", &["pdf"])
                .set_file_name("Signed document.pdf")
                .save_file()
            else {
                return Ok(Value::Null);
            };
            let view = call(&app.state::<Backend>(), json!({"action":"view","id":id}))?;
            if view["source"]
                .as_str()
                .is_some_and(|s| std::fs::canonicalize(s).ok() == std::fs::canonicalize(&path).ok())
            {
                return Err("Save the signed revision to a separate file.".into());
            }
            pdf_core::session::atomic_write(&path, &signed).map_err(|e| e.to_string())?;
            pdf_core::signatures::verify(&signed).map_err(|e| e.to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn reveal_recent(app: tauri::AppHandle, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let value = call(
            &app.state::<Backend>(),
            json!({"action":"recent_path","id":id}),
        )?;
        let path = value
            .as_str()
            .ok_or("This document has not been saved to a file.")?;
        if !std::path::Path::new(path).is_file() {
            return Err("The source file has moved or is unavailable.".into());
        }
        Command::new("explorer.exe")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn export_file(data: String, name: String, encoded: bool) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if data.len() > 400 * 1024 * 1024 {
            return Err("Export exceeds the safety limit.".into());
        }
        let filename = std::path::Path::new(&name)
            .file_name()
            .ok_or("Invalid filename")?
            .to_string_lossy();
        let Some(path) = rfd::FileDialog::new()
            .set_file_name(filename.as_ref())
            .save_file()
        else {
            return Ok(false);
        };
        let bytes = if encoded {
            base64::engine::general_purpose::STANDARD
                .decode(data)
                .map_err(|e| e.to_string())?
        } else {
            data.into_bytes()
        };
        pdf_core::session::atomic_write(&path, &bytes).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn main() {
    let args: Vec<_> = std::env::args().collect();
    if args.get(1).is_some_and(|a| a == "--pdf-worker") {
        if args.len() == 4 {
            let _ = pdf_core::workspace::worker_main(
                std::path::Path::new(&args[2]),
                args[3].clone().into(),
            );
        }
        return;
    }
    tauri::Builder::default()
        .setup(|app| {
            if let (Some(window), Some(icon)) =
                (app.get_webview_window("main"), app.default_window_icon())
            {
                window.set_icon(icon.clone())?;
            }
            let library = app.path().resource_dir()?.join("pdfium.dll");
            #[cfg(debug_assertions)]
            let library = if library.exists() {
                library
            } else {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../../vendor/pdfium/bin/pdfium.dll")
            };
            let recovery = app.path().app_local_data_dir()?.join("recovery");
            app.manage(Backend(Mutex::new(
                Worker::start(library, recovery).map_err(std::io::Error::other)?,
            )));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api,
            open_document,
            save_document,
            digital_sign,
            export_file,
            reveal_recent,
            open_dropped
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start application");
}
