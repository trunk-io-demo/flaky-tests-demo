//! The branch shapes this story emits, and why each one is here.
//!
//! The point is not "some branches fail more." It is that a viewer configuring
//! a monitor with a branch filter needs branch names that *distinguish* their
//! patterns. `release/*`, `release/?.?.?`, and `release/*.beta` are three
//! different filters, and telling them apart requires branch names where they
//! disagree:
//!
//! | Branch                | `release/*` | `release/?.?.?` | `release/*.beta` |
//! | --------------------- | ----------- | --------------- | ---------------- |
//! | `release/1.4.2`       | matches     | matches         | no               |
//! | `release/2.0.0.beta`  | matches     | no              | matches          |
//!
//! So the two release branches are not decoration. Without both, two of those
//! three filters are indistinguishable in the data.

use junit_gen::{Attribution, AttributionBase, BranchClass, ProtectedBranches};

/// A branch shape, its intended class, and the rate its tests fail at.
#[derive(Debug, Clone)]
pub struct BranchStory {
    /// The branch name uploads are attributed to.
    pub branch: String,
    /// Percentage of runs on this branch in which a test fails.
    pub failure_rate: u8,
    /// How the upload should be attributed.
    pub shape: Shape,
}

/// The legal attribution shapes, one per branch class.
///
/// Enumerated rather than assembled from fields so that an illegal combination
/// — a protected branch that also carries a PR number, a merge-queue branch
/// whose PR number will be ignored and warned about — is not expressible.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shape {
    /// A protected branch. The name must be one the org actually protects, or
    /// the run arrives as `NONE`.
    Protected,
    /// A pull-request branch, with a fabricated PR number.
    PullRequest(u64),
    /// A merge-queue run. The prefix is added for you.
    MergeQueue,
    /// Any other branch — the `NONE` fallthrough, which is where most real
    /// release-branch runs land unless the org protects them explicitly.
    Unclassified,
}

impl BranchStory {
    pub fn new(branch: impl Into<String>, failure_rate: u8, shape: Shape) -> Self {
        Self {
            branch: branch.into(),
            failure_rate,
            shape,
        }
    }

    /// The class this story should arrive as, so the manifest can log the intent
    /// beside the result.
    pub fn expected_class(&self, protected: &ProtectedBranches) -> BranchClass {
        match self.shape {
            Shape::Protected => BranchClass::ProtectedBranch,
            Shape::PullRequest(_) => BranchClass::PullRequest,
            Shape::MergeQueue => BranchClass::Merge,
            Shape::Unclassified => BranchClass::infer(&self.branch, None, protected),
        }
    }

    /// Build the attribution for this story.
    pub fn attribute(
        &self,
        base: AttributionBase,
        protected: &ProtectedBranches,
    ) -> anyhow::Result<Attribution> {
        Ok(match self.shape {
            Shape::Protected => Attribution::on_protected_branch(base, &self.branch, protected)?,
            Shape::PullRequest(number) => Attribution::on_pull_request(base, number, &self.branch),
            Shape::MergeQueue => Attribution::on_merge_queue(base, &self.branch),
            Shape::Unclassified => Attribution::unclassified(base, &self.branch),
        })
    }

    /// A short slug for file names and log lines.
    pub fn slug(&self) -> String {
        self.branch
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn protected() -> ProtectedBranches {
        ProtectedBranches::new(["main"])
    }

    #[test]
    fn the_release_branches_distinguish_the_three_filters_they_exist_for() {
        // Glob semantics, spelled out: `?` matches one character, `*` matches
        // any run of them. These are the checks a reader would do by hand, and
        // they are the reason both release branches are emitted.
        let semver = "release/1.4.2";
        let beta = "release/2.0.0.beta";

        // release/* matches both.
        assert!(semver.starts_with("release/") && beta.starts_with("release/"));

        // release/?.?.? — three single characters separated by dots — matches
        // only the semver one.
        assert!(matches_single_char_semver(semver));
        assert!(!matches_single_char_semver(beta));

        // release/*.beta matches only the beta one.
        assert!(!semver.ends_with(".beta"));
        assert!(beta.ends_with(".beta"));
    }

    fn matches_single_char_semver(branch: &str) -> bool {
        let Some(version) = branch.strip_prefix("release/") else {
            return false;
        };
        let parts: Vec<&str> = version.split('.').collect();
        parts.len() == 3 && parts.iter().all(|p| p.chars().count() == 1)
    }

    #[test]
    fn each_shape_arrives_as_the_class_it_advertises() {
        let base = || {
            AttributionBase::new(
                "https://github.com/example/repo",
                "0123456789abcdef0123456789abcdef01234567",
                "synth",
                chrono::DateTime::from_timestamp(1_770_000_000, 0).expect("valid epoch"),
                protected(),
            )
        };

        for story in [
            BranchStory::new("main", 5, Shape::Protected),
            BranchStory::new("feature/widget", 50, Shape::PullRequest(1234)),
            BranchStory::new("main", 10, Shape::MergeQueue),
            BranchStory::new("release/1.4.2", 20, Shape::Unclassified),
        ] {
            let attribution = story
                .attribute(base(), &protected())
                .expect("legal shape attributes");
            assert_eq!(
                attribution.branch_class,
                story.expected_class(&protected()),
                "{} did not arrive as advertised",
                story.branch
            );
        }
    }

    #[test]
    fn a_release_branch_the_org_does_not_protect_is_none_not_pb() {
        // The trap this story is built to make visible: `release/*` looking like
        // a protected-branch pattern does not make `release/1.4.2` protected.
        // Protected matching is exact.
        let story = BranchStory::new("release/1.4.2", 20, Shape::Unclassified);
        assert_eq!(story.expected_class(&protected()), BranchClass::None);

        let with_it_protected = ProtectedBranches::new(["main", "release/1.4.2"]);
        assert_eq!(
            story.expected_class(&with_it_protected),
            BranchClass::ProtectedBranch
        );
    }

    #[test]
    fn slugs_are_safe_for_file_names() {
        assert_eq!(
            BranchStory::new("release/2.0.0.beta", 1, Shape::Unclassified).slug(),
            "release-2-0-0-beta"
        );
    }
}
