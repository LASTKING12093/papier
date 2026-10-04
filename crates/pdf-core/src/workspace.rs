use crate::{
    engine::{EditCommand, PdfEngine},
    fail,
    session::{read_pdf, DocumentSession, SessionView},
    Result,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, Write},
    path::{Path, PathBuf},
};

pub struct Workspace {
    engine: PdfEngine,
    sessions: HashMap<String, DocumentSession>,
    recovery: PathBuf,
    qpdf: PathBuf,
}
impl Workspace {
    pub fn new(library: &Path, recovery: PathBuf) -> Result<Self> {
        fs::create_dir_all(&recovery)?;
        Ok(Self {
            engine: PdfEngine::new(library)?,
            sessions: HashMap::new(),
            recovery,
            qpdf: library
                .parent()
                .ok_or("Invalid runtime location")?
                .join("qpdf/qpdf.exe"),
        })
    }
    fn add(
        &mut self,
        bytes: Vec<u8>,
        source: Option<PathBuf>,
        name: Option<String>,
    ) -> Result<Value> {
        if bytes.len() > crate::session::MAX_FILE_BYTES as usize {
            return fail("File exceeds the 256 MB safety limit.");
        }
        let info = self.engine.info(&bytes)?;
        let mut s = DocumentSession::new(bytes, info, source);
        if let Some(name) = name {
            s.name = Path::new(&name)
                .file_name()
                .ok_or("Invalid name")?
                .to_string_lossy()
                .into_owned();
        }
        let view = s.view();
        crate::library::remember(
            &self.recovery.join("library"),
            &s.name,
            s.source.as_deref(),
            &s.bytes,
            format!(
                "data:image/png;base64,{}",
                STANDARD.encode(self.engine.render(&s.bytes, 0, 220)?)
            ),
            s.info.pages.len(),
        )?;
        self.sessions.insert(s.id.clone(), s);
        Ok(json!(view))
    }
    pub fn dispatch(&mut self, request: Value) -> Result<Value> {
        let action = request["action"].as_str().ok_or("Missing action")?;
        let id = request["id"].as_str().unwrap_or("");
        let p = &request["payload"];
        match action {
            "sessions" => {
                return Ok(json!(self
                    .sessions
                    .values()
                    .map(DocumentSession::view)
                    .collect::<Vec<_>>()))
            }
            "create" => {
                let mut bytes = self.engine.create_sized(
                    p["width"].as_f64().unwrap_or(595.276) as f32,
                    p["height"].as_f64().unwrap_or(841.89) as f32,
                    p["pages"].as_u64().unwrap_or(1) as usize,
                )?;
                if let Some(commands) = p["commands"].as_array() {
                    if commands.len() > 1000 {
                        return fail("Too many template elements.");
                    }
                    for command in commands {
                        bytes = self
                            .engine
                            .edit(&bytes, &serde_json::from_value(command.clone())?)?;
                    }
                }
                return self.add(bytes, None, p["name"].as_str().map(str::to_owned));
            }
            "recent_list" => {
                return Ok(json!(crate::library::load(&self.recovery.join("library"))?))
            }
            "recent_preview" => {
                let root = self.recovery.join("library");
                let rows = crate::library::load(&root)?;
                let row = rows
                    .iter()
                    .find(|r| r.id == id)
                    .ok_or("This recent file is no longer listed.")?;
                let bytes = read_pdf(&crate::library::path(&root, row)?)?;
                // Read-only preview: never create a session or change the recent order.
                return Ok(json!(format!(
                    "data:image/png;base64,{}",
                    STANDARD.encode(self.engine.render(&bytes, 0, 640)?)
                )));
            }
            "recent_open" | "recent_duplicate" | "recent_pin" | "recent_remove" | "recent_path" => {
                let root = self.recovery.join("library");
                let mut rows = crate::library::load(&root)?;
                let i = rows
                    .iter()
                    .position(|r| r.id == id)
                    .ok_or("This recent file is no longer listed.")?;
                let row = rows[i].clone();
                let path = crate::library::path(&root, &row)?;
                if action == "recent_path" {
                    return Ok(json!(row.source));
                }
                if action == "recent_remove" {
                    rows.remove(i);
                    crate::library::store(&root, &rows)?;
                    if row.source.is_none() && path.exists() {
                        fs::remove_file(path)?;
                    }
                    return Ok(Value::Null);
                }
                if action == "recent_pin" {
                    rows[i].pinned = !rows[i].pinned;
                    crate::library::store(&root, &rows)?;
                    return Ok(Value::Null);
                }
                let bytes = read_pdf(&path)?;
                if action == "recent_duplicate" {
                    return self.add(
                        bytes,
                        None,
                        Some(format!("{} copy.pdf", row.name.trim_end_matches(".pdf"))),
                    );
                }
                rows[i].opened = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)?
                    .as_secs();
                crate::library::store(&root, &rows)?;
                // Imported copies remain unsaved; they are not treated as user source files.
                let result = self.add(bytes, row.source.map(PathBuf::from), Some(row.name))?;
                if rows[i].source.is_none() {
                    let mut current = crate::library::load(&root)?;
                    if current.first().is_some_and(|r| r.id != id) {
                        if let Some(first) = current.first_mut() {
                            first.pinned = rows[i].pinned;
                        }
                        current.retain(|r| r.id != id);
                        crate::library::store(&root, &current)?;
                        if path.exists() {
                            fs::remove_file(path)?;
                        }
                    }
                }
                return Ok(result);
            }
            "import" => {
                return self.add(
                    STANDARD.decode(p["data"].as_str().ok_or("No document data")?)?,
                    None,
                    p["name"].as_str().map(str::to_owned),
                )
            }
            "open" => {
                let path = PathBuf::from(p["path"].as_str().ok_or("No path")?);
                return self.add(read_pdf(&path)?, Some(path), None);
            }
            "recovery_list" => {
                let mut list = Vec::new();
                for entry in fs::read_dir(&self.recovery)?.flatten() {
                    if entry.path().extension().is_some_and(|s| s == "json") {
                        if let Ok(v) =
                            serde_json::from_slice::<SessionView>(&fs::read(entry.path())?)
                        {
                            list.push(v);
                        }
                    }
                }
                return Ok(json!(list));
            }
            "recover" => {
                uuid::Uuid::parse_str(id)?;
                let path = self.recovery.join(format!("{}.pdf", id));
                let result = self.add(
                    read_pdf(&path)?,
                    None,
                    Some("Recovered document.pdf".into()),
                )?;
                return Ok(result);
            }
            _ => {}
        }
        let s = self
            .sessions
            .get_mut(id)
            .ok_or("This document session is closed. Open it again.")?;
        match action {
            "validate" => {
                let (_, report) = crate::native_tools::qpdf(&self.qpdf, &s.bytes, "validate")?;
                Ok(report)
            }
            "validate_signatures" => crate::signatures::verify(&s.bytes),
            "prepare_signature" => {
                Ok(json!(STANDARD.encode(crate::signatures::prepare(&s.bytes)?)))
            }
            "repair" | "optimize" => {
                if s.info.signatures > 0 {
                    return fail("Save an unsigned copy before structural transformations.");
                }
                let (bytes, _) = crate::native_tools::qpdf(&self.qpdf, &s.bytes, action)?;
                let bytes = bytes.ok_or("No output was produced")?;
                let info = self.engine.info(&bytes)?;
                s.snapshot(&self.recovery, action)?;
                s.commit(
                    bytes,
                    info,
                    if action == "repair" {
                        "Repair PDF"
                    } else {
                        "Optimize PDF"
                    },
                );
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "view" => Ok(json!(s.view())),
            "render" => {
                let page = u16::try_from(p["page"].as_u64().ok_or("Invalid page")?)?;
                let width = i32::try_from(p["width"].as_i64().ok_or("Invalid width")?)?;
                Ok(json!(format!(
                    "data:image/png;base64,{}",
                    STANDARD.encode(self.engine.render(&s.bytes, page, width)?)
                )))
            }
            "object_layers" => {
                if p["revision"].as_u64() != Some(s.view().revision) {
                    return fail("The document changed. Select the object again.");
                }
                Ok(json!(self.engine.object_layers(
                    &s.bytes,
                    u16::try_from(p["page"].as_u64().ok_or("Invalid page")?)?,
                    usize::try_from(p["object"].as_u64().ok_or("Invalid object")?)?,
                    i32::try_from(p["width"].as_i64().ok_or("Invalid width")?)?
                )?))
            }
            "inspect" => Ok(json!(self.engine.inspect(
                &s.bytes,
                u16::try_from(p["page"].as_u64().ok_or("Invalid page")?)?
            )?)),
            "text" => Ok(json!(self.engine.text(&s.bytes)?)),
            "redact" => {
                if s.info.signatures > 0 {
                    return fail("Extract an unsigned copy before redacting a signed document.");
                }
                let rect = serde_json::from_value(p["rect"].clone())?;
                let page = u16::try_from(p["page"].as_u64().ok_or("Invalid page")?)?;
                let bytes = self.engine.redact(&s.bytes, page, &rect)?;
                let info = self.engine.info(&bytes)?;
                s.snapshot(&self.recovery, "redaction")?;
                s.commit(bytes, info, "Secure image redaction");
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "export" => {
                self.engine.info(&s.bytes)?;
                Ok(json!(STANDARD.encode(&s.bytes)))
            }
            "export_text" => Ok(json!(self.engine.text(&s.bytes)?.join("\n\n"))),
            "copy_object" => Ok(json!(STANDARD.encode(self.engine.copy_object(
                &s.bytes,
                u16::try_from(p["page"].as_u64().ok_or("Invalid page")?)?,
                p["object"].as_u64().ok_or("Invalid object")? as usize
            )?))),
            "paste_object" => {
                if s.info.signatures > 0 {
                    return fail("Create an unsigned copy before editing.");
                }
                let copied = STANDARD.decode(p["data"].as_str().ok_or("Clipboard is empty")?)?;
                let bytes = self.engine.paste_object(
                    &s.bytes,
                    &copied,
                    u16::try_from(p["page"].as_u64().ok_or("Invalid page")?)?,
                )?;
                let info = self.engine.info(&bytes)?;
                s.commit(bytes, info, "Paste object");
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "extract" => {
                let pages: Vec<u16> = serde_json::from_value(p["pages"].clone())?;
                Ok(json!(
                    STANDARD.encode(self.engine.extract(&s.bytes, &pages)?)
                ))
            }
            "edit" => {
                if s.info.signatures > 0 && p["acceptSignatureInvalidation"] != true {
                    return fail("SIGNATURE_WARNING: Modifying this document can invalidate digital signatures. Work on a copy and acknowledge before editing.");
                }
                if p["revision"].as_u64() != Some(s.revision) {
                    return fail("The document changed. Select the object again before editing.");
                }
                let cmd: EditCommand = serde_json::from_value(p["command"].clone())?;
                if matches!(cmd, EditCommand::Sanitize | EditCommand::FlattenForms) {
                    s.snapshot(&self.recovery, cmd.label())?;
                }
                let bytes = self.engine.edit(&s.bytes, &cmd)?;
                let info = self.engine.info(&bytes)?;
                s.commit(bytes, info, cmd.label());
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "edit_batch" => {
                if s.info.signatures > 0 {
                    return fail("Create an unsigned copy before editing.");
                }
                if p["revision"].as_u64() != Some(s.revision) {
                    return fail("The document changed. Try again.");
                }
                let commands = p["commands"].as_array().ok_or("Missing commands")?;
                if commands.is_empty() || commands.len() > 1000 {
                    return fail("Choose 1–1000 edits.");
                }
                let mut bytes = s.bytes.clone();
                for command in commands {
                    bytes = self
                        .engine
                        .edit(&bytes, &serde_json::from_value(command.clone())?)?;
                }
                let info = self.engine.info(&bytes)?;
                s.commit(bytes, info, p["label"].as_str().unwrap_or("Edit objects"));
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "undo" => {
                let info = self.engine.info(s.undo_bytes().ok_or("Nothing to undo")?)?;
                s.undo(info)?;
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "redo" => {
                let info = self.engine.info(s.redo_bytes().ok_or("Nothing to redo")?)?;
                s.redo(info)?;
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "merge" | "insert_pdf" => {
                if s.info.signatures > 0 {
                    return fail("Signed documents cannot be merged in place. Extract a separate unsigned copy first.");
                }
                let other = STANDARD.decode(p["data"].as_str().ok_or("No PDF data")?)?;
                let bytes = if action == "insert_pdf" {
                    self.engine.insert(
                        &s.bytes,
                        &other,
                        u16::try_from(p["at"].as_u64().ok_or("Invalid insertion position")?)?,
                    )?
                } else {
                    self.engine.merge(&s.bytes, &other)?
                };
                let info = self.engine.info(&bytes)?;
                s.commit(bytes, info, "Merge PDF");
                s.recover(&self.recovery)?;
                Ok(json!(s.view()))
            }
            "compare" => {
                let other = STANDARD.decode(p["data"].as_str().ok_or("No PDF data")?)?;
                let a = self.engine.text(&s.bytes)?;
                let b = self.engine.text(&other)?;
                let pages=(0..a.len().max(b.len())).map(|i|json!({"page":i,"before":a.get(i),"after":b.get(i),"changed":a.get(i)!=b.get(i)})).collect::<Vec<_>>();
                Ok(json!(pages))
            }
            "protect" => {
                use lopdf::{EncryptionState, EncryptionVersion, Permissions};
                use rand::RngCore;
                use std::{collections::BTreeMap, sync::Arc};
                let password = zeroize::Zeroizing::new(
                    p["password"].as_str().ok_or("Enter a password")?.to_owned(),
                );
                if password.len() < 8 {
                    return fail("Use a password of at least 8 characters.");
                }
                let mut key = zeroize::Zeroizing::new([0u8; 32]);
                rand::rng().fill_bytes(&mut *key);
                let owner = zeroize::Zeroizing::new(uuid::Uuid::new_v4().to_string());
                let state = EncryptionState::try_from(EncryptionVersion::V5 {
                    encrypt_metadata: true,
                    crypt_filters: BTreeMap::from([(
                        b"StdCF".to_vec(),
                        Arc::new(lopdf::encryption::crypt_filters::Aes256CryptFilter)
                            as Arc<dyn lopdf::encryption::crypt_filters::CryptFilter>,
                    )]),
                    file_encryption_key: &*key,
                    stream_filter: b"StdCF".to_vec(),
                    string_filter: b"StdCF".to_vec(),
                    owner_password: &owner,
                    user_password: &password,
                    permissions: Permissions::all(),
                })?;
                let mut d = lopdf::Document::load_mem(&s.bytes)?;
                d.encrypt(&state)?;
                let mut out = Vec::new();
                d.save_to(&mut out)?;
                let mut verify = lopdf::Document::load_mem(&out)?;
                verify.decrypt(&password)?;
                Ok(json!(STANDARD.encode(out)))
            }
            "save" => {
                let path = PathBuf::from(p["path"].as_str().ok_or("No output path")?);
                self.engine.info(&s.bytes)?;
                s.save(&path, p["copy"] == true, p["overwriteExternal"] == true)?;
                crate::library::remember(
                    &self.recovery.join("library"),
                    &s.name,
                    Some(&path),
                    &s.bytes,
                    format!(
                        "data:image/png;base64,{}",
                        STANDARD.encode(self.engine.render(&s.bytes, 0, 220)?)
                    ),
                    s.info.pages.len(),
                )?;
                if !s.view().dirty {
                    for ext in ["pdf", "json"] {
                        let path = self.recovery.join(format!("{}.{}", s.id, ext));
                        if path.exists() {
                            fs::remove_file(path)?;
                        }
                    }
                }
                Ok(json!(s.view()))
            }
            "close" => {
                if s.view().dirty && p["discard"] != true {
                    return fail("This document has unsaved changes.");
                }
                for ext in ["pdf", "json"] {
                    let path = self.recovery.join(format!("{}.{}", s.id, ext));
                    if path.exists() {
                        fs::remove_file(path)?;
                    }
                }
                self.sessions.remove(id);
                Ok(Value::Null)
            }
            _ => fail("Unknown document command."),
        }
    }
}
pub fn worker_main(library: &Path, recovery: PathBuf) -> Result<()> {
    let mut workspace = Workspace::new(library, recovery)?;
    let stdin = std::io::stdin();
    let mut out = std::io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.len() > 400 * 1024 * 1024 {
            return fail("Request exceeds the process limit.");
        }
        let result = serde_json::from_str(&line)
            .map_err(|e| e.into())
            .and_then(|v| workspace.dispatch(v));
        let response = match result {
            Ok(value) => json!({"ok":true,"value":value}),
            Err(e) => json!({"ok":false,"error":e.to_string()}),
        };
        writeln!(out, "{}", response)?;
        out.flush()?;
    }
    Ok(())
}
