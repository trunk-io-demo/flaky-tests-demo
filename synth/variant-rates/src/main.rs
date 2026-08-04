//! Emits the same tests under several variants, each with its own failure rate.
//!
//! "Only flaky on macOS" is the story every team recognizes, and it is normally
//! expensive to demonstrate: macOS runner minutes cost roughly ten times what
//! Linux minutes cost, and the whole point is that the test runs *often* enough
//! for a rate to be visible.
//!
//! Nothing here runs on macOS. The variant is a field on the upload, so a Linux
//! runner can fabricate the entire matrix — which is also a more honest demo of
//! what a variant *is*: a label the product groups by, not a machine.
//!
//! Because variant is part of test identity, the same test emitted under three
//! variants is three tests in the product. That is what makes a per-variant rate
//! expressible at all.
//!
//! Run it:
//!
//! ```text
//! SYNTH_REPO_URL=https://github.com/your-org/your-fork cargo run -p variant-rates
//! ```

use anyhow::Result;
use clap::Parser;
use junit_gen::report::{write_report, Durations};
use junit_gen::{
    render, Attribution, CommonArgs, DateBucket, Manifest, Outcome, ReportSpec, StoryRng,
    TestCaseSpec, TestIdentity, UploadEntry,
};

const STORY_ID: &str = "variant-rates";

/// The tests emitted under every variant.
///
/// Chosen to be things that plausibly *are* platform-sensitive — paths, file
/// watchers, clipboards, line endings — so the story reads as a real
/// platform-specific bug rather than as an arbitrary rate difference.
const CASES: &[(&str, &str)] = &[
    ("FileWatcher", "notices_a_rename"),
    ("FileWatcher", "debounces_rapid_writes"),
    ("Clipboard", "round_trips_unicode"),
    ("PathHandling", "normalizes_separators"),
];

#[derive(Debug, Parser)]
#[command(
    name = "variant-rates",
    about = "Emit the same tests under several variants, each with its own failure rate."
)]
struct Args {
    #[command(flatten)]
    common: CommonArgs,

    /// Failure rate for the `linux` variant. The quiet one.
    #[arg(long, env = "SYNTH_VARIANT_RATE_LINUX", default_value = "3")]
    rate_linux: u8,

    /// Failure rate for the `macos` variant. The story.
    #[arg(long, env = "SYNTH_VARIANT_RATE_MACOS", default_value = "34")]
    rate_macos: u8,

    /// Failure rate for the `windows` variant. Between the two, so that "only
    /// flaky on macOS" is a claim about a distribution rather than a binary.
    #[arg(long, env = "SYNTH_VARIANT_RATE_WINDOWS", default_value = "12")]
    rate_windows: u8,

    /// Variant names, comma-separated, in the same order as the rates above.
    ///
    /// Renaming a variant changes test identity, so the renamed variant starts
    /// with no history rather than inheriting the old one's.
    #[arg(
        long,
        env = "SYNTH_VARIANTS",
        value_delimiter = ',',
        default_value = "linux,macos,windows"
    )]
    variants: Vec<String>,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let now = args.common.now();
    let bucket = DateBucket::hour_of(now);
    let protected = args.common.protected();

    let branch = protected
        .first()
        .ok_or_else(|| {
            anyhow::anyhow!(
                "no protected branches configured; set --protected-branches, or these runs upload \
                 as NONE and a per-variant comparison on a protected branch is not what you get"
            )
        })?
        .to_owned();

    let rates = [args.rate_linux, args.rate_macos, args.rate_windows];
    if args.variants.len() > rates.len() {
        anyhow::bail!(
            "{} variants configured but only {} rates exist; add a rate argument before adding a \
             variant, or the extra variants silently share the last rate",
            args.variants.len(),
            rates.len()
        );
    }

    // One commit for the whole matrix. Variants of the same commit is exactly
    // what a real matrix build produces, and it is what lets the product show
    // three variants of one change side by side.
    let base = args.common.attribution_base(&[STORY_ID, &bucket.key()]);

    let out_dir = args.common.out_dir.join(STORY_ID);
    let durations = Durations::default();
    let mut manifest = Manifest::new();
    let mut summary = Vec::new();

    for (variant, rate) in args.variants.iter().zip(rates) {
        let attribution = Attribution::on_protected_branch(
            base.clone().with_variant(variant.clone()),
            &branch,
            &protected,
        )?;

        let mut spec = ReportSpec::new(format!("synth-variant-rates-{variant}"), now);

        // Emitted under every variant, so "this variant stopped reporting" is
        // distinguishable from "this variant had a clean run". A variant that
        // goes silent is a resolution, and without this you cannot tell which
        // kind.
        let mut healthcheck_rng =
            StoryRng::derive_with(STORY_ID, bucket, &format!("{variant}#healthcheck"));
        spec.push(TestCaseSpec::new(
            TestIdentity::in_suite(STORY_ID, "Healthcheck", "variant_generator_is_reporting"),
            Outcome::Pass,
            durations.draw(&mut healthcheck_rng, Outcome::Pass),
        ));

        let mut failures = 0;
        for (suite, name) in CASES {
            let mut rng =
                StoryRng::derive_with(STORY_ID, bucket, &format!("{variant}#{suite}#{name}"));
            let outcome = if rng.chance(rate) {
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
                    "synthetic failure on the {variant} variant at a configured rate of {rate}%"
                ));
            }
            spec.push(case);
        }

        let junit_path = write_report(&out_dir, &format!("junit-{variant}.xml"), &render(&spec))?;
        manifest.push(UploadEntry::new(
            junit_path.to_string_lossy().into_owned(),
            format!(
                "variant-rates: {variant} at {rate}% ({failures} of {} failing)",
                CASES.len()
            ),
            &attribution,
        ));
        summary.push((variant.clone(), rate, failures));
    }

    let manifest_path = manifest.write(&out_dir)?;

    if !args.common.quiet {
        println!("variant-rates: bucket {}", bucket.key());
        println!(
            "variant-rates: one commit {}, {} variants",
            &base.head_sha[..12],
            summary.len()
        );
        for (variant, rate, failures) in &summary {
            println!(
                "variant-rates: {variant} at {rate}% — {failures}/{} failing",
                CASES.len()
            );
        }
        println!("variant-rates: wrote {}", manifest_path.display());
    }

    Ok(())
}
