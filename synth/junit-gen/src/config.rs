//! Arguments shared by every `synth/` generator.
//!
//! Behavior is tuned through repository variables, never by editing a
//! generator. Each argument therefore has an `env` fallback, and CI sets the
//! environment rather than assembling a command line.

use std::path::PathBuf;

use chrono::{DateTime, Utc};
use clap::Parser;

use crate::attribution::{AttributionBase, ProtectedBranches};
use crate::seed::{fabricated_sha, DateBucket};

/// Flattened into every generator's own argument struct.
#[derive(Debug, Clone, Parser)]
pub struct CommonArgs {
    /// Directory to write JUnit XML and the upload manifest into.
    #[arg(long, env = "SYNTH_OUT_DIR", default_value = "synth-out")]
    pub out_dir: PathBuf,

    /// Repository URL that uploads are attributed to.
    ///
    /// Required with no default on purpose. The repository name is part of
    /// every test's identity, so a default would let a fork silently attribute
    /// its runs to the original repository's tests — the failure mode being
    /// that the fork's data appears to arrive and then merges into someone
    /// else's history.
    #[arg(long, env = "SYNTH_REPO_URL")]
    pub repo_url: String,

    /// Commit author name that uploads are attributed to.
    #[arg(long, env = "SYNTH_AUTHOR_NAME", default_value = "synth")]
    pub author_name: String,

    /// Branches the org has configured as protected, comma-separated.
    ///
    /// Matching is exact, not glob. A branch that is not in this list arrives
    /// as `NONE` rather than as `PB`, which is the usual reason a
    /// protected-branch story does not look like one.
    #[arg(
        long,
        env = "SYNTH_PROTECTED_BRANCHES",
        value_delimiter = ',',
        default_value = "main"
    )]
    pub protected_branches: Vec<String>,

    /// Pin the current time, as RFC 3339.
    ///
    /// Every window in `synth/` is expressed relative to this rather than as an
    /// absolute date, because run history ages out — an absolute date would make
    /// a forked demo rot silently. Overriding it is how you reproduce a
    /// yesterday that has already gone.
    #[arg(long, env = "SYNTH_NOW")]
    pub now: Option<DateTime<Utc>>,

    /// Override the derived seed.
    ///
    /// Only for reproducing one specific surprising run. Leaving it unset is
    /// what makes a story reproducible *by derivation*, which is the property
    /// that survives a fork.
    #[arg(long, env = "SYNTH_SEED")]
    pub seed: Option<u64>,

    /// Write the JUnit and the manifest, then stop without printing upload
    /// instructions. Set by CI, which reads the manifest itself.
    #[arg(long, env = "SYNTH_QUIET")]
    pub quiet: bool,
}

impl CommonArgs {
    /// The moment every window is measured from.
    pub fn now(&self) -> DateTime<Utc> {
        self.now.unwrap_or_else(Utc::now)
    }

    /// The day bucket containing [`CommonArgs::now`].
    pub fn bucket(&self) -> DateBucket {
        DateBucket::day_of(self.now())
    }

    pub fn protected(&self) -> ProtectedBranches {
        ProtectedBranches::new(self.protected_branches.clone())
    }

    /// An attribution base for a logical commit identified by `commit_parts`.
    ///
    /// The SHA is derived from those parts, so two uploads that mean the same
    /// commit produce the same SHA — which matters because pass-on-retry pairs
    /// are formed per commit — and two that mean different commits do not
    /// collide.
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
        // A default here would let a fork upload into the original's test
        // identities. Better to fail at startup.
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
