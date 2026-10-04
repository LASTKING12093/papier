use crate::{engine::DocumentInfo, fail, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::VecDeque,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

const HISTORY_BUDGET: usize = 128 * 1024 * 1024;
pub const MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
pub fn fingerprint(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
#[derive(Clone)]
struct Revision {
    bytes: Vec<u8>,
    label: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct SessionView {
    pub id: String,
    pub name: String,
    pub dirty: bool,
    pub revision: u64,
    pub undo: Option<String>,
    pub redo: Option<String>,
    pub info: DocumentInfo,
    pub source: Option<String>,
}
pub struct DocumentSession {
    pub id: String,
    pub name: String,
    pub source: Option<PathBuf>,
    pub bytes: Vec<u8>,
    pub info: DocumentInfo,
    pub revision: u64,
    source_hash: Option<String>,
    saved_hash: String,
    undo: VecDeque<Revision>,
    redo: VecDeque<Revision>,
}
impl DocumentSession {
    pub fn new(bytes: Vec<u8>, info: DocumentInfo, source: Option<PathBuf>) -> Self {
        let hash = fingerprint(&bytes);
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: source
                .as_ref()
                .and_then(|p| p.file_name())
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "Untitled.pdf".into()),
            source_hash: source.as_ref().map(|_| hash.clone()),
            saved_hash: if source.is_some() {
                hash
            } else {
                String::new()
            },
            source,
            bytes,
            info,
            revision: 0,
            undo: VecDeque::new(),
            redo: VecDeque::new(),
        }
    }
    pub fn view(&self) -> SessionView {
        SessionView {
            id: self.id.clone(),
            name: self.name.clone(),
            dirty: fingerprint(&self.bytes) != self.saved_hash,
            revision: self.revision,
            undo: self.undo.back().map(|r| r.label.clone()),
            redo: self.redo.back().map(|r| r.label.clone()),
            info: self.info.clone(),
            source: self
                .source
                .as_ref()
                .map(|p| p.to_string_lossy().into_owned()),
        }
    }
    pub fn commit(&mut self, bytes: Vec<u8>, info: DocumentInfo, label: &str) {
        let old = std::mem::replace(&mut self.bytes, bytes);
        self.undo.push_back(Revision {
            bytes: old,
            label: label.into(),
        });
        self.redo.clear();
        while !self.undo.is_empty()
            && self.undo.iter().map(|r| r.bytes.len()).sum::<usize>() > HISTORY_BUDGET
        {
            self.undo.pop_front();
        }
        self.info = info;
        self.revision += 1;
    }
    pub fn undo_bytes(&self) -> Option<&[u8]> {
        self.undo.back().map(|r| r.bytes.as_slice())
    }
    pub fn redo_bytes(&self) -> Option<&[u8]> {
        self.redo.back().map(|r| r.bytes.as_slice())
    }
    pub fn undo(&mut self, info: DocumentInfo) -> Result<()> {
        let r = self.undo.pop_back().ok_or("Nothing to undo.")?;
        let old = std::mem::replace(&mut self.bytes, r.bytes);
        self.redo.push_back(Revision {
            bytes: old,
            label: r.label,
        });
        self.info = info;
        self.revision += 1;
        Ok(())
    }
    pub fn redo(&mut self, info: DocumentInfo) -> Result<()> {
        let r = self.redo.pop_back().ok_or("Nothing to redo.")?;
        let old = std::mem::replace(&mut self.bytes, r.bytes);
        self.undo.push_back(Revision {
            bytes: old,
            label: r.label,
        });
        self.info = info;
        self.revision += 1;
        Ok(())
    }
    pub fn save(&mut self, path: &Path, copy: bool, overwrite_external: bool) -> Result<()> {
        if path
            .extension()
            .is_none_or(|e| !e.eq_ignore_ascii_case("pdf"))
        {
            return fail("Choose a filename ending in .pdf.");
        }
        let same = self.source.as_ref().is_some_and(|p| {
            p == path
                || fs::canonicalize(p)
                    .ok()
                    .zip(fs::canonicalize(path).ok())
                    .is_some_and(|(a, b)| a == b)
        });
        if same && !overwrite_external {
            let current = fs::read(path)?;
            if Some(fingerprint(&current)) != self.source_hash {
                return fail("EXTERNAL_CHANGE: The original changed outside Papier. Reload it, save a copy, or explicitly overwrite.");
            }
        }
        if same && self.info.signatures > 0 {
            return fail("Signed originals are protected. Save a separate copy; modifications can invalidate signatures.");
        }
        atomic_write(path, &self.bytes)?;
        if !copy {
            self.source = Some(path.to_owned());
            self.name = path
                .file_name()
                .ok_or("Invalid filename")?
                .to_string_lossy()
                .into_owned();
            let hash = fingerprint(&self.bytes);
            self.saved_hash = hash.clone();
            self.source_hash = Some(hash);
        }
        Ok(())
    }
    pub fn recover(&self, dir: &Path) -> Result<()> {
        fs::create_dir_all(dir)?;
        atomic_write(&dir.join(format!("{}.pdf", self.id)), &self.bytes)?;
        atomic_write(
            &dir.join(format!("{}.json", self.id)),
            &serde_json::to_vec(&self.view())?,
        )?;
        prune_recovery(dir, &self.id)?;
        Ok(())
    }
    pub fn snapshot(&self, dir: &Path, label: &str) -> Result<()> {
        let mut view = self.view();
        view.id = uuid::Uuid::new_v4().to_string();
        view.name = format!("{} — before {}", self.name, label);
        atomic_write(&dir.join(format!("{}.pdf", view.id)), &self.bytes)?;
        atomic_write(
            &dir.join(format!("{}.json", view.id)),
            &serde_json::to_vec(&view)?,
        )?;
        prune_recovery(dir, &self.id)
    }
}
fn prune_recovery(dir: &Path, current: &str) -> Result<()> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(dir)?.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|s| s == "pdf") {
            let Some(id) = path.file_stem().and_then(|s| s.to_str()) else {
                continue;
            };
            if uuid::Uuid::parse_str(id).is_err() {
                continue;
            }
            let meta = entry.metadata()?;
            entries.push((id.to_owned(), meta.modified()?, meta.len()));
        }
    }
    entries.sort_by_key(|a| std::cmp::Reverse(a.1));
    let mut bytes = 0;
    for (index, (id, _, size)) in entries.into_iter().enumerate() {
        bytes += size;
        if id != current && (index >= 30 || bytes > 1024 * 1024 * 1024) {
            for ext in ["pdf", "json"] {
                let path = dir.join(format!("{id}.{ext}"));
                if path.exists() {
                    fs::remove_file(path)?;
                }
            }
        }
    }
    Ok(())
}
pub fn read_pdf(path: &Path) -> Result<Vec<u8>> {
    let meta = fs::metadata(path)?;
    if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return fail("The file exceeds the 256 MB safety limit.");
    }
    let data = fs::read(path)?;
    if !data.windows(5).take(1024).any(|w| w == b"%PDF-") {
        return fail("This file does not contain a PDF header.");
    }
    Ok(data)
}
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or("Invalid output folder")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)?;
    temp.write_all(bytes)?;
    temp.as_file().sync_all()?;
    temp.persist(path).map_err(|e| e.error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn info() -> DocumentInfo {
        DocumentInfo {
            pages: vec![],
            signatures: 0,
            bytes: 0,
            metadata: serde_json::json!({}),
        }
    }
    #[test]
    fn history_and_external_change() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.pdf");
        fs::write(&path, b"original").unwrap();
        let mut s = DocumentSession::new(b"original".to_vec(), info(), Some(path.clone()));
        s.commit(b"changed".to_vec(), info(), "Edit text");
        assert!(s.view().dirty);
        s.undo(info()).unwrap();
        assert!(!s.view().dirty);
        s.redo(info()).unwrap();
        fs::write(&path, b"external").unwrap();
        assert!(s.save(&path, false, false).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external");
        s.save(&path, false, true).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"changed");
        assert!(!s.view().dirty);
    }
    #[test]
    fn failed_save_does_not_touch_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("original.pdf");
        fs::write(&path, b"original").unwrap();
        assert!(atomic_write(&dir.path().join("missing/output.pdf"), b"new").is_err());
        assert_eq!(fs::read(path).unwrap(), b"original");
    }
}
