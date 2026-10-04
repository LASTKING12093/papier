//! Local recent-file index. Native files stay at their original path; browser imports
//! keep an explicit local working copy. Removing a recent never deletes the source.
use crate::{session::atomic_write, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Serialize, Deserialize)]
pub struct Recent {
    pub id: String,
    pub name: String,
    pub source: Option<String>,
    pub thumbnail: String,
    pub opened: u64,
    pub bytes: usize,
    pub pages: usize,
    pub pinned: bool,
    #[serde(default)]
    pub fingerprint: String,
}
pub fn load(root: &Path) -> Result<Vec<Recent>> {
    let path = root.join("recent.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}
pub fn store(root: &Path, rows: &[Recent]) -> Result<()> {
    fs::create_dir_all(root)?;
    atomic_write(&root.join("recent.json"), &serde_json::to_vec(rows)?)
}
pub fn path(root: &Path, row: &Recent) -> Result<PathBuf> {
    uuid::Uuid::parse_str(&row.id)?;
    Ok(row
        .source
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join(format!("{}.pdf", row.id))))
}
pub fn remember(
    root: &Path,
    name: &str,
    source: Option<&Path>,
    bytes: &[u8],
    thumbnail: String,
    pages: usize,
) -> Result<()> {
    let mut rows = load(root)?;
    let source = source.map(|s| s.to_string_lossy().to_string());
    let fingerprint = crate::session::fingerprint(bytes);
    let existing = rows.iter().position(|r| {
        if source.is_some() {
            r.source == source
        } else {
            r.source.is_none() && r.name == name && r.fingerprint == fingerprint
        }
    });
    let old = existing.map(|i| rows.remove(i));
    let row = Recent {
        id: old
            .as_ref()
            .map(|r| r.id.clone())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        name: name.into(),
        source,
        thumbnail,
        opened: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs(),
        bytes: bytes.len(),
        pages,
        pinned: old.is_some_and(|r| r.pinned),
        fingerprint,
    };
    fs::create_dir_all(root)?;
    if row.source.is_none() {
        atomic_write(&path(root, &row)?, bytes)?;
    }
    rows.insert(0, row);
    // Bound both thumbnails and imported copies. Pinned entries are retained
    // unless the byte budget requires removing an imported working copy.
    let mut cached = 0usize;
    let mut keep = Vec::new();
    for row in rows {
        if row.source.is_none() {
            cached += row.bytes;
        }
        if (keep.len() < 24 || row.pinned) && cached <= 512 * 1024 * 1024 {
            keep.push(row);
        } else if row.source.is_none() {
            let p = path(root, &row)?;
            if p.exists() {
                fs::remove_file(p)?;
            }
        }
    }
    store(root, &keep)
}
