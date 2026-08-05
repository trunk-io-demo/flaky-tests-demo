//! The branch shapes this story emits. Two release branches, because `release/*`,
//! `release/?.?.?` and `release/*.beta` are three filters and one branch name
//! cannot distinguish them.

use junit_gen::{Attribution, AttributionBase, BranchClass, ProtectedBranches};

#[derive(Debug, Clone)]
pub struct BranchStory {
    pub branch: String,
    pub failure_rate: u8,
    pub shape: Shape,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shape {
    Protected,
    PullRequest(u64),
    MergeQueue,
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

    pub fn expected_class(&self, protected: &ProtectedBranches) -> BranchClass {
        match self.shape {
            Shape::Protected => BranchClass::ProtectedBranch,
            Shape::PullRequest(_) => BranchClass::PullRequest,
            Shape::MergeQueue => BranchClass::Merge,
            Shape::Unclassified => BranchClass::infer(&self.branch, None, protected),
        }
    }

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
        let semver = "release/1.4.2";
        let beta = "release/2.0.0.beta";

        assert!(semver.starts_with("release/") && beta.starts_with("release/"));

        assert!(matches_single_char_semver(semver));
        assert!(!matches_single_char_semver(beta));

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
