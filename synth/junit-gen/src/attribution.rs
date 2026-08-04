//! Fabricated upload attribution, and the branch-class mapping.
//!
//! Uploads from `synth/` need no git history, no branch, and no pull request:
//! the uploader's uncloned-repo mode takes repository URL, head SHA, head
//! branch, and author name as explicit inputs, alongside PR number and commit
//! epoch. Every attribution field is fabricable.
//!
//! **Branch class is derived, not set.** The uploader infers it from the branch
//! name and the PR number, so configuration here expresses a *desired class*
//! and the constructors produce naming that yields it.
//!
//! The precedence is reproduced in [`BranchClass::infer`] rather than imported.
//! The crate that owns it upstream also pulls in protobuf, vendored OpenSSL,
//! and git bindings — minutes of build time and a protobuf compiler on the
//! runner, to reuse one `match`. The tests below pin the behavior instead, and
//! the mapping is documented in `docs/architecture.md` where a reader will
//! find it.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::Serialize;

/// Branch-name fragments that make the uploader classify a branch as a merge
/// event. Any of them wins over everything else, including a set PR number.
const MERGE_QUEUE_MARKERS: &[&str] = &["trunk-merge/", "gh-readonly-queue/", "/gtmq_"];
const MERGE_QUEUE_PREFIX: &str = "gtmq_";

/// Branch prefixes that imply a pull request even with no PR number set.
const PULL_REQUEST_PREFIXES: &[&str] = &["pull/", "remotes/pull/"];

/// The class the product groups runs by.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum BranchClass {
    /// A merge-queue run.
    Merge,
    /// A run attributed to a pull request.
    PullRequest,
    /// A run on a protected branch.
    ProtectedBranch,
    /// The fallthrough.
    None,
}

impl BranchClass {
    /// The uploader's inference, in its precedence order.
    ///
    /// | Target  | How it is produced                           |
    /// | ------- | -------------------------------------------- |
    /// | `MERGE` | branch contains a merge-queue prefix         |
    /// | `PR`    | a PR number is set, or a `pull/` branch       |
    /// | `PB`    | branch matches a configured protected branch |
    /// | `NONE`  | anything else                                |
    pub fn infer(branch: &str, pr_number: Option<u64>, protected: &ProtectedBranches) -> Self {
        let merge_queue = MERGE_QUEUE_MARKERS.iter().any(|m| branch.contains(m))
            || branch.starts_with(MERGE_QUEUE_PREFIX);

        if merge_queue {
            Self::Merge
        } else if pr_number.is_some() || PULL_REQUEST_PREFIXES.iter().any(|p| branch.starts_with(p))
        {
            Self::PullRequest
        } else if protected.contains(branch) {
            Self::ProtectedBranch
        } else {
            Self::None
        }
    }

    /// The product's short label for this class.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Merge => "MERGE",
            Self::PullRequest => "PR",
            Self::ProtectedBranch => "PB",
            Self::None => "NONE",
        }
    }
}

/// The org's configured protected branches.
///
/// Matching is exact, not glob: `release/*` being a protected-branch *pattern*
/// in some other setting does not make `release/1.2.0` a protected branch here.
/// Getting this wrong is the usual reason a run intended as `PB` arrives as
/// `NONE`.
#[derive(Debug, Clone, Default)]
pub struct ProtectedBranches(Vec<String>);

impl ProtectedBranches {
    pub fn new<I, S>(branches: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        Self(branches.into_iter().map(Into::into).collect())
    }

    pub fn contains(&self, branch: &str) -> bool {
        self.0.iter().any(|b| b == branch)
    }

    pub fn first(&self) -> Option<&str> {
        self.0.first().map(String::as_str)
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

/// One upload's worth of fabricated attribution.
///
/// There is no public field-by-field constructor, and that is the point.
/// Illegal combinations — a protected branch that also carries a PR number, a
/// merge-queue branch with a PR number that will be silently ignored — produce
/// validation warnings that look bad on screen mid-demo. Only the legal pairs
/// are constructible: [`Attribution::on_merge_queue`],
/// [`Attribution::on_pull_request`], [`Attribution::on_protected_branch`], and
/// [`Attribution::unclassified`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Attribution {
    pub repo_url: String,
    pub head_sha: String,
    pub head_branch: String,
    pub author_name: String,
    pub commit_epoch: i64,
    pub pr_number: Option<u64>,
    pub variant: Option<String>,
    pub branch_class: BranchClass,
}

impl Attribution {
    /// A merge-queue run. The branch is prefixed so the uploader classifies it
    /// as `MERGE`; no PR number is set, because on a merge-queue branch it
    /// would be ignored and warned about.
    pub fn on_merge_queue(base: AttributionBase, target_branch: &str) -> Self {
        let branch = format!("gh-readonly-queue/{target_branch}/{}", &base.head_sha[..8]);
        base.finish(branch, None)
    }

    /// A pull-request run. No real pull request is required — the PR-number
    /// override is enough to make the uploader classify the run as `PR`.
    pub fn on_pull_request(base: AttributionBase, pr_number: u64, branch: &str) -> Self {
        base.finish(branch.to_owned(), Some(pr_number))
    }

    /// A protected-branch run. `branch` must be one the org has configured as
    /// protected, or the run arrives as `NONE` instead — so this returns an
    /// error rather than producing a story that quietly is not the one asked
    /// for.
    pub fn on_protected_branch(
        base: AttributionBase,
        branch: &str,
        protected: &ProtectedBranches,
    ) -> Result<Self, UnclassifiableBranch> {
        if !protected.contains(branch) {
            return Err(UnclassifiableBranch {
                branch: branch.to_owned(),
                wanted: BranchClass::ProtectedBranch,
            });
        }
        Ok(base.finish(branch.to_owned(), None))
    }

    /// A run on no branch of consequence — the `NONE` fallthrough. This is the
    /// class most real feature-branch runs land in.
    pub fn unclassified(base: AttributionBase, branch: &str) -> Self {
        base.finish(branch.to_owned(), None)
    }

    /// The environment the uploader reads this attribution from.
    ///
    /// Keys come from the uploader's own constants rather than being retyped,
    /// so a rename upstream surfaces as a build failure here instead of as a
    /// field the uploader silently never sees.
    pub fn to_env(&self) -> BTreeMap<String, String> {
        let mut env = BTreeMap::new();
        env.insert(
            constants::TRUNK_USE_UNCLONED_REPO_ENV.to_owned(),
            "true".to_owned(),
        );
        env.insert(
            constants::TRUNK_REPO_URL_ENV.to_owned(),
            self.repo_url.clone(),
        );
        env.insert(
            constants::TRUNK_REPO_HEAD_SHA_ENV.to_owned(),
            self.head_sha.clone(),
        );
        env.insert(
            constants::TRUNK_REPO_HEAD_BRANCH_ENV.to_owned(),
            self.head_branch.clone(),
        );
        env.insert(
            constants::TRUNK_REPO_HEAD_AUTHOR_NAME_ENV.to_owned(),
            self.author_name.clone(),
        );
        env.insert(
            constants::TRUNK_REPO_HEAD_COMMIT_EPOCH_ENV.to_owned(),
            self.commit_epoch.to_string(),
        );
        if let Some(pr_number) = self.pr_number {
            env.insert(
                constants::TRUNK_PR_NUMBER_ENV.to_owned(),
                pr_number.to_string(),
            );
        }
        if let Some(variant) = &self.variant {
            env.insert(constants::TRUNK_VARIANT_ENV.to_owned(), variant.clone());
        }
        env
    }
}

/// The parts of an attribution that do not decide the branch class.
#[derive(Debug, Clone)]
pub struct AttributionBase {
    pub repo_url: String,
    pub head_sha: String,
    pub author_name: String,
    pub committed_at: DateTime<Utc>,
    pub variant: Option<String>,
    protected: ProtectedBranches,
}

impl AttributionBase {
    pub fn new(
        repo_url: impl Into<String>,
        head_sha: impl Into<String>,
        author_name: impl Into<String>,
        committed_at: DateTime<Utc>,
        protected: ProtectedBranches,
    ) -> Self {
        Self {
            repo_url: repo_url.into(),
            head_sha: head_sha.into(),
            author_name: author_name.into(),
            committed_at,
            variant: None,
            protected,
        }
    }

    /// Tag this upload with a variant. The variant is part of test identity, so
    /// the same test uploaded under two variants is two tests in the product —
    /// which is exactly what makes "only flaky on macOS" expressible.
    pub fn with_variant(mut self, variant: impl Into<String>) -> Self {
        self.variant = Some(variant.into());
        self
    }

    fn finish(self, branch: String, pr_number: Option<u64>) -> Attribution {
        let branch_class = BranchClass::infer(&branch, pr_number, &self.protected);
        Attribution {
            repo_url: self.repo_url,
            head_sha: self.head_sha,
            head_branch: branch,
            author_name: self.author_name,
            commit_epoch: self.committed_at.timestamp(),
            pr_number,
            variant: self.variant,
            branch_class,
        }
    }
}

/// A requested branch class the given branch name cannot produce.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnclassifiableBranch {
    pub branch: String,
    pub wanted: BranchClass,
}

impl std::fmt::Display for UnclassifiableBranch {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "branch {:?} cannot be classified as {}: it is not in the configured protected branches",
            self.branch,
            self.wanted.label()
        )
    }
}

impl std::error::Error for UnclassifiableBranch {}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> AttributionBase {
        AttributionBase::new(
            "https://github.com/example/repo",
            "0123456789abcdef0123456789abcdef01234567",
            "synth",
            DateTime::from_timestamp(1_770_000_000, 0).expect("valid epoch"),
            ProtectedBranches::new(["main", "release/1.0.0"]),
        )
    }

    #[test]
    fn merge_queue_wins_over_a_pr_number() {
        let protected = ProtectedBranches::new(["main"]);
        assert_eq!(
            BranchClass::infer("gh-readonly-queue/main/abc123", Some(42), &protected),
            BranchClass::Merge
        );
        assert_eq!(
            BranchClass::infer("trunk-merge/main", Some(42), &protected),
            BranchClass::Merge
        );
        assert_eq!(
            BranchClass::infer("gtmq_abc", None, &protected),
            BranchClass::Merge
        );
        assert_eq!(
            BranchClass::infer("some/gtmq_abc", None, &protected),
            BranchClass::Merge
        );
        // Merge queue wins over protected, too.
        assert_eq!(
            BranchClass::infer("trunk-merge/main", None, &ProtectedBranches::new(["main"])),
            BranchClass::Merge
        );
    }

    #[test]
    fn a_pr_number_beats_a_protected_branch_name() {
        let protected = ProtectedBranches::new(["main"]);
        assert_eq!(
            BranchClass::infer("main", Some(7), &protected),
            BranchClass::PullRequest
        );
        // Which is why `on_protected_branch` refuses to set one.
    }

    #[test]
    fn pull_prefixed_branches_are_prs_without_a_number() {
        let protected = ProtectedBranches::default();
        assert_eq!(
            BranchClass::infer("pull/123/merge", None, &protected),
            BranchClass::PullRequest
        );
        assert_eq!(
            BranchClass::infer("remotes/pull/123/merge", None, &protected),
            BranchClass::PullRequest
        );
    }

    #[test]
    fn protected_matching_is_exact_not_glob() {
        let protected = ProtectedBranches::new(["main", "release/1.0.0"]);
        assert_eq!(
            BranchClass::infer("release/1.0.0", None, &protected),
            BranchClass::ProtectedBranch
        );
        // The trap: a pattern that looks protected but is not configured.
        assert_eq!(
            BranchClass::infer("release/1.0.1", None, &protected),
            BranchClass::None
        );
        assert_eq!(
            BranchClass::infer("release/1.0.0.beta", None, &protected),
            BranchClass::None
        );
    }

    #[test]
    fn everything_else_falls_through_to_none() {
        assert_eq!(
            BranchClass::infer(
                "feature/add-widget",
                None,
                &ProtectedBranches::new(["main"])
            ),
            BranchClass::None
        );
    }

    #[test]
    fn constructors_produce_the_class_they_advertise() {
        let protected = ProtectedBranches::new(["main", "release/1.0.0"]);

        let merge = Attribution::on_merge_queue(base(), "main");
        assert_eq!(merge.branch_class, BranchClass::Merge);
        assert!(merge.head_branch.starts_with("gh-readonly-queue/main/"));
        assert_eq!(merge.pr_number, None);

        let pr = Attribution::on_pull_request(base(), 4321, "feature/add-widget");
        assert_eq!(pr.branch_class, BranchClass::PullRequest);
        assert_eq!(pr.pr_number, Some(4321));

        let pb = Attribution::on_protected_branch(base(), "main", &protected)
            .expect("main is configured protected");
        assert_eq!(pb.branch_class, BranchClass::ProtectedBranch);
        assert_eq!(pb.pr_number, None);

        let none = Attribution::unclassified(base(), "feature/add-widget");
        assert_eq!(none.branch_class, BranchClass::None);
    }

    #[test]
    fn protected_branch_refuses_a_branch_that_would_arrive_as_none() {
        let protected = ProtectedBranches::new(["main"]);
        let err = Attribution::on_protected_branch(base(), "release/9.9.9", &protected)
            .expect_err("release/9.9.9 is not configured protected");
        assert_eq!(err.wanted, BranchClass::ProtectedBranch);
        assert!(err.to_string().contains("release/9.9.9"));
    }

    #[test]
    fn env_carries_every_field_the_uploader_needs() {
        let pr = Attribution::on_pull_request(base().with_variant("macos"), 4321, "feature/x");
        let env = pr.to_env();

        assert_eq!(env["TRUNK_USE_UNCLONED_REPO"], "true");
        assert_eq!(env["TRUNK_REPO_URL"], "https://github.com/example/repo");
        assert_eq!(
            env["TRUNK_REPO_HEAD_SHA"],
            "0123456789abcdef0123456789abcdef01234567"
        );
        assert_eq!(env["TRUNK_REPO_HEAD_BRANCH"], "feature/x");
        assert_eq!(env["TRUNK_REPO_HEAD_AUTHOR_NAME"], "synth");
        assert_eq!(env["TRUNK_REPO_HEAD_COMMIT_EPOCH"], "1770000000");
        assert_eq!(env["TRUNK_PR_NUMBER"], "4321");
        assert_eq!(env["TRUNK_VARIANT"], "macos");
    }

    #[test]
    fn env_omits_absent_optional_fields_rather_than_emptying_them() {
        // An empty TRUNK_PR_NUMBER is not the same as an unset one — the
        // uploader would fail to parse it as an integer.
        let env = Attribution::unclassified(base(), "feature/x").to_env();
        assert!(!env.contains_key("TRUNK_PR_NUMBER"));
        assert!(!env.contains_key("TRUNK_VARIANT"));
    }
}
