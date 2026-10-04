use crate::{fail, Result};
use serde_json::{json, Value};
use std::{
    fs,
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
pub fn qpdf(exe: &Path, bytes: &[u8], operation: &str) -> Result<(Option<Vec<u8>>, Value)> {
    let dir = tempfile::tempdir()?;
    let input = dir.path().join("input.pdf");
    let output = dir.path().join("output.pdf");
    let log = dir.path().join("report.txt");
    fs::write(&input, bytes)?;
    let mut command = Command::new(exe);
    command
        .stdout(Stdio::from(fs::File::create(&log)?))
        .stderr(Stdio::from(fs::File::options().append(true).open(&log)?));
    match operation {
        "validate" => {
            command.arg("--check").arg(&input);
        }
        "repair" => {
            command.arg("--warning-exit-0").arg(&input).arg(&output);
        }
        "optimize" => {
            command
                .args([
                    "--object-streams=generate",
                    "--recompress-flate",
                    "--compression-level=9",
                ])
                .arg(&input)
                .arg(&output);
        }
        _ => return fail("Unknown qpdf operation."),
    };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn()?;
    let start = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if start.elapsed() > Duration::from_secs(45) {
            child.kill()?;
            child.wait()?;
            return fail("The PDF operation exceeded its 45-second safety limit.");
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    let report = fs::read_to_string(log)?.replace(
        &dir.path().to_string_lossy().to_string(),
        "[working directory]",
    );
    if !status.success() && status.code() != Some(3) {
        return fail(&format!("PDF validation failed: {}", report));
    }
    let bytes = if operation == "validate" {
        None
    } else {
        Some(fs::read(&output)?)
    };
    Ok((
        bytes,
        json!({"valid":status.success(),"warnings":status.code()==Some(3),"report":report}),
    ))
}
