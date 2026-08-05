//! The upload manifest: one JSON line per upload, since a single run produces many
//! uploads with different attribution and the CI action streams them.

use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::Serialize;

use crate::attribution::{Attribution, BranchClass};

pub const MANIFEST_FILE_NAME: &str = "uploads.jsonl";

#[derive(Debug, Clone, Serialize)]
pub struct UploadEntry {
    pub junit_path: String,
    pub label: String,
    pub branch_class: BranchClass,
    pub env: BTreeMap<String, String>,
}

impl UploadEntry {
    pub fn new(
        junit_path: impl Into<String>,
        label: impl Into<String>,
        attribution: &Attribution,
    ) -> Self {
        Self {
            junit_path: junit_path.into(),
            label: label.into(),
            branch_class: attribution.branch_class,
            env: attribution.to_env(),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Manifest {
    entries: Vec<UploadEntry>,
}

impl Manifest {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, entry: UploadEntry) {
        self.entries.push(entry);
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn entries(&self) -> &[UploadEntry] {
        &self.entries
    }

    pub fn write(&self, dir: impl AsRef<Path>) -> Result<PathBuf> {
        let dir = dir.as_ref();
        fs::create_dir_all(dir).with_context(|| format!("creating {}", dir.display()))?;

        let path = dir.join(MANIFEST_FILE_NAME);
        let mut file =
            fs::File::create(&path).with_context(|| format!("creating {}", path.display()))?;

        for entry in &self.entries {
            let line = serde_json::to_string(entry).context("serializing manifest entry")?;
            writeln!(file, "{line}").with_context(|| format!("writing {}", path.display()))?;
        }
        Ok(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::attribution::{AttributionBase, ProtectedBranches};
    use chrono::DateTime;

    fn attribution() -> Attribution {
        let base = AttributionBase::new(
            "https://github.com/example/repo",
            "0123456789abcdef0123456789abcdef01234567",
            "synth",
            DateTime::from_timestamp(1_770_000_000, 0).expect("valid epoch"),
            ProtectedBranches::new(["main"]),
        );
        Attribution::on_pull_request(base, 99, "feature/x")
    }

    #[test]
    fn each_entry_is_one_self_contained_line() {
        let mut manifest = Manifest::new();
        for i in 0..3 {
            manifest.push(UploadEntry::new(
                format!("synth-out/junit-{i}.xml"),
                format!("upload {i}"),
                &attribution(),
            ));
        }

        let dir = std::env::temp_dir().join(format!("junit-gen-manifest-{}", std::process::id()));
        let path = manifest.write(&dir).expect("writes");
        let contents = fs::read_to_string(&path).expect("reads");

        let lines: Vec<&str> = contents.lines().collect();
        assert_eq!(lines.len(), 3);
        for line in lines {
            let parsed: serde_json::Value = serde_json::from_str(line).expect("valid json");
            assert!(parsed["junit_path"].as_str().is_some());
            assert_eq!(parsed["branch_class"], "PullRequest");
            assert_eq!(parsed["env"]["TRUNK_PR_NUMBER"], "99");
            assert_eq!(parsed["env"]["TRUNK_USE_UNCLONED_REPO"], "true");
        }

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn an_empty_manifest_is_still_written() {
        let dir = std::env::temp_dir().join(format!("junit-gen-empty-{}", std::process::id()));
        let path = Manifest::new().write(&dir).expect("writes");
        assert!(path.exists());
        assert_eq!(fs::read_to_string(&path).expect("reads"), "");
        fs::remove_dir_all(&dir).ok();
    }
}
