//! Emits the same tests on several branches, each with its own failure rate.
//!
//! What this makes demonstrable is *branch-filtered monitor configuration*. The
//! test identities are identical across branches, so the only thing that
//! differs is the branch a run arrived on — which is exactly the variable a
//! branch filter selects on. Set a monitor to watch `main` and it sees a quiet
//! test; point the same monitor at `release/*` and the same test is noisy.
//!
//! Run it:
//!
//! ```text
//! SYNTH_REPO_URL=https://github.com/your-org/your-fork cargo run -p branch-rates
//! ```

mod branches;

use anyhow::Result;
use chrono::NaiveDate;
use clap::Parser;
use junit_gen::report::{write_report, Durations};
use junit_gen::{
    render, CommonArgs, DateBucket, Manifest, Outcome, ReportSpec, StoryRng, TestCaseSpec,
    TestIdentity, UploadEntry,
};

use crate::branches::{BranchStory, Shape};

const STORY_ID: &str = "branch-rates";

/// The tests emitted on every branch.
///
/// Identical identities across branches is the whole mechanism — the same test,
/// seen through different branch filters. Keep this list short: it is
/// multiplied by the number of branches on every run.
const CASES: &[(&str, &str)] = &[
    ("Checkout", "charges_the_card"),
    ("Checkout", "applies_sales_tax"),
    ("Checkout", "emails_the_receipt"),
    ("Inventory", "decrements_stock"),
];

#[derive(Debug, Parser)]
#[command(
    name = "branch-rates",
    about = "Emit the same tests across branch shapes, each with its own failure rate."
)]
struct Args {
    #[command(flatten)]
    common: CommonArgs,

    /// Failure rate on the protected branch.
    ///
    /// Keep this the lowest of the set. A protected branch that fails as often
    /// as a pull-request branch tells nobody anything.
    #[arg(long, env = "SYNTH_BRANCH_RATE_PROTECTED", default_value = "4")]
    rate_protected: u8,

    /// Failure rate on the merge-queue branch.
    #[arg(long, env = "SYNTH_BRANCH_RATE_MERGE_QUEUE", default_value = "9")]
    rate_merge_queue: u8,

    /// Failure rate on the numbered release branch.
    #[arg(long, env = "SYNTH_BRANCH_RATE_RELEASE_SEMVER", default_value = "22")]
    rate_release_semver: u8,

    /// Failure rate on the pre-release branch.
    #[arg(long, env = "SYNTH_BRANCH_RATE_RELEASE_BETA", default_value = "38")]
    rate_release_beta: u8,

    /// Failure rate on pull-request branches. The highest of the set: this is
    /// where unreviewed work lands.
    #[arg(long, env = "SYNTH_BRANCH_RATE_PULL_REQUEST", default_value = "55")]
    rate_pull_request: u8,

    /// The numbered release branch.
    ///
    /// Must match `release/?.?.?` as well as `release/*`, or one of the three
    /// filters this story exists to distinguish becomes untestable.
    #[arg(
        long,
        env = "SYNTH_BRANCH_RELEASE_SEMVER",
        default_value = "release/1.4.2"
    )]
    branch_release_semver: String,

    /// The pre-release branch.
    ///
    /// Must match `release/*.beta` but *not* `release/?.?.?`.
    #[arg(
        long,
        env = "SYNTH_BRANCH_RELEASE_BETA",
        default_value = "release/2.0.0.beta"
    )]
    branch_release_beta: String,

    /// The pull-request branch name.
    #[arg(
        long,
        env = "SYNTH_BRANCH_PULL_REQUEST",
        default_value = "feature/promo-codes"
    )]
    branch_pull_request: String,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let now = args.common.now();
    let bucket = DateBucket::hour_of(now);
    let protected = args.common.protected();

    let protected_branch = protected
        .first()
        .ok_or_else(|| {
            anyhow::anyhow!(
                "no protected branches configured; set --protected-branches, or the protected \
                 branch leg of this story uploads as NONE and the comparison it exists for \
                 disappears"
            )
        })?
        .to_owned();

    let stories = vec![
        BranchStory::new(&protected_branch, args.rate_protected, Shape::Protected),
        BranchStory::new(&protected_branch, args.rate_merge_queue, Shape::MergeQueue),
        BranchStory::new(
            &args.branch_release_semver,
            args.rate_release_semver,
            Shape::Unclassified,
        ),
        BranchStory::new(
            &args.branch_release_beta,
            args.rate_release_beta,
            Shape::Unclassified,
        ),
        BranchStory::new(
            &args.branch_pull_request,
            args.rate_pull_request,
            Shape::PullRequest(daily_pr_number(now.date_naive())),
        ),
    ];

    let out_dir = args.common.out_dir.join(STORY_ID);
    let durations = Durations::default();
    let mut manifest = Manifest::new();
    let mut summary = Vec::new();

    for story in &stories {
        let class = story.expected_class(&protected);
        let class_slug = class.label().to_lowercase();

        // Each leg is its own commit. The class is part of the derivation
        // because two legs can share a branch name — a protected branch and its
        // own merge queue — and if they shared a commit too, their runs would be
        // paired with each other for pass-on-retry purposes. That is a different
        // story than this one, and it would show up as a pass-on-retry detection
        // nobody asked for.
        let base =
            args.common
                .attribution_base(&[STORY_ID, &bucket.key(), &story.branch, &class_slug]);
        let attribution = story.attribute(base, &protected)?;

        let mut spec = ReportSpec::new(format!("synth-branch-rates-{}", story.slug()), now);

        // The healthcheck is emitted on every branch so that "this branch went
        // quiet" is distinguishable from "this branch's tests all passed".
        let mut healthcheck_rng =
            StoryRng::derive_with(STORY_ID, bucket, &format!("{}#healthcheck", story.branch));
        spec.push(TestCaseSpec::new(
            TestIdentity::in_suite(STORY_ID, "Healthcheck", "branch_generator_is_reporting"),
            Outcome::Pass,
            durations.draw(&mut healthcheck_rng, Outcome::Pass),
        ));

        let mut failures = 0;
        for (suite, name) in CASES {
            // The class is in the discriminator for the same reason it is in the
            // commit derivation: the protected leg and the merge-queue leg share
            // a branch name, and sharing a stream too would correlate their
            // outcomes despite their different configured rates.
            let mut rng = StoryRng::derive_with(
                STORY_ID,
                bucket,
                &format!("{}#{class_slug}#{suite}#{name}", story.branch),
            );
            let outcome = if rng.chance(story.failure_rate) {
                failures += 1;
                Outcome::Fail
            } else {
                Outcome::Pass
            };

            let mut case = TestCaseSpec::new(
                TestIdentity::in_suite(STORY_ID, suite, name),
                outcome,
                durations.draw(&mut rng, outcome),
            );
            if outcome == Outcome::Fail {
                case = case.with_message(format!(
                    "synthetic failure on {} at a configured rate of {}%",
                    story.branch, story.failure_rate
                ));
            }
            spec.push(case);
        }

        let file_name = format!("junit-{}-{class_slug}.xml", story.slug());
        let junit_path = write_report(&out_dir, &file_name, &render(&spec))?;

        manifest.push(UploadEntry::new(
            junit_path.to_string_lossy().into_owned(),
            format!(
                "branch-rates: {} as {} at {}% ({} of {} failing)",
                story.branch,
                class.label(),
                story.failure_rate,
                failures,
                CASES.len()
            ),
            &attribution,
        ));
        summary.push((story.branch.clone(), class, failures));
    }

    let manifest_path = manifest.write(&out_dir)?;

    if !args.common.quiet {
        println!("branch-rates: bucket {}", bucket.key());
        for (branch, class, failures) in &summary {
            println!(
                "branch-rates: {branch} [{}] {failures}/{} failing",
                class.label(),
                CASES.len()
            );
        }
        println!("branch-rates: wrote {}", manifest_path.display());
    }

    Ok(())
}

/// A stable, plausible PR number for a given day.
///
/// No real pull request is required: the PR-number override alone is enough for
/// the uploader to classify a run as `PR`. It changes daily, because a pull
/// request that stayed open for months would be the odd thing here.
fn daily_pr_number(date: NaiveDate) -> u64 {
    let epoch = NaiveDate::from_ymd_opt(1970, 1, 1).expect("the epoch is a valid date");
    let days = (date - epoch).num_days().unsigned_abs();
    1_000 + (days % 9_000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pr_numbers_are_stable_per_day_and_plausible() {
        let date = NaiveDate::from_ymd_opt(2026, 8, 4).expect("valid date");
        let next = NaiveDate::from_ymd_opt(2026, 8, 5).expect("valid date");

        assert_eq!(daily_pr_number(date), daily_pr_number(date));
        assert_ne!(daily_pr_number(date), daily_pr_number(next));
        assert!((1_000..10_000).contains(&daily_pr_number(date)));
    }
}
