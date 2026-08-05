//! Arguments shared by every generator. `SYNTH_REPO_URL` has no default because
//! the repository name is part of test identity, so a default would let a fork's
//! runs merge into the original's history.

use std::path::PathBuf;

use chrono::{DateTime, Utc};
use clap::Parser;

use crate::attribution::{AttributionBase, ProtectedBranches};
use crate::seed::{fabricated_sha, DateBucket};

#[derive(Debug, Clone, Parser)]
pub struct CommonArgs {
    #[arg(long, env = "SYNTH_OUT_DIR", default_value = "synth-out")]
    pub out_dir: PathBuf,

    #[arg(long, env = "SYNTH_REPO_URL")]
    pub repo_url: String,

    #[arg(long, env = "SYNTH_AUTHOR_NAME", default_value = "synth")]
    pub author_name: String,

    #[arg(
        long,
        env = "SYNTH_PROTECTED_BRANCHES",
        value_delimiter = ',',
        default_value = "main"
    )]
    pub protected_branches: Vec<String>,

    #[arg(long, env = "SYNTH_NOW")]
    pub now: Option<DateTime<Utc>>,

    #[arg(long, env = "SYNTH_SEED")]
    pub seed: Option<u64>,

    #[arg(long, env = "SYNTH_QUIET")]
    pub quiet: bool,
}

impl CommonArgs {
    pub fn now(&self) -> DateTime<Utc> {
        self.now.unwrap_or_else(Utc::now)
    }

    pub fn bucket(&self) -> DateBucket {
        DateBucket::day_of(self.now())
    }

    pub fn protected(&self) -> ProtectedBranches {
        ProtectedBranches::new(self.protected_branches.clone())
    }

    pub fn attribution_base(&self, commit_parts: &[&str]) -> AttributionBase {
        AttributionBase::new(
            self.repo_url.clone(),
            fabricated_sha(commit_parts),
            self.author_name.clone(),
            self.now(),
            self.protected(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(args: &[&str]) -> CommonArgs {
        CommonArgs::try_parse_from(std::iter::once("synth-test").chain(args.iter().copied()))
            .expect("parses")
    }

    #[test]
    fn repo_url_has_no_default() {
        assert!(CommonArgs::try_parse_from(["synth-test"]).is_err());
    }

    #[test]
    fn protected_branches_split_on_commas() {
        let args = parse(&[
            "--repo-url",
            "https://github.com/example/repo",
            "--protected-branches",
            "main,release/1.0.0",
        ]);
        assert!(args.protected().contains("main"));
        assert!(args.protected().contains("release/1.0.0"));
        assert!(!args.protected().contains("release/1.0.1"));
    }

    #[test]
    fn now_is_parsed_as_rfc3339_and_pins_the_bucket() {
        let args = parse(&[
            "--repo-url",
            "https://github.com/example/repo",
            "--now",
            "2026-08-04T13:45:00Z",
        ]);
        assert_eq!(args.bucket().key(), "2026-08-04");
    }

    #[test]
    fn the_same_commit_parts_give_the_same_sha() {
        let args = parse(&["--repo-url", "https://github.com/example/repo"]);
        let a = args.attribution_base(&["cohorts", "2026-08-04"]);
        let b = args.attribution_base(&["cohorts", "2026-08-04"]);
        let c = args.attribution_base(&["cohorts", "2026-08-05"]);

        assert_eq!(a.head_sha, b.head_sha);
        assert_ne!(a.head_sha, c.head_sha);
    }
}
