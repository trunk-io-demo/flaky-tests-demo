//! "Only flaky on macOS", from a Linux runner. A variant is a field on the upload,
//! so one runner fabricates the whole matrix. Variant is part of identity, so the
//! same test under three variants is three tests. Each case carries a weight so
//! the four are not four identical tests.

use anyhow::Result;
use clap::Parser;
use junit_gen::report::{write_report, Durations};
use junit_gen::{
    render, Attribution, CommonArgs, DateBucket, Manifest, Outcome, ReportSpec, StoryRng,
    TestCaseSpec, TestIdentity, UploadEntry,
};

const STORY_ID: &str = "variant-rates";

const CASES: &[(&str, &str, u32)] = &[
    ("FileWatcher", "notices_a_rename", 50),
    ("FileWatcher", "debounces_rapid_writes", 100),
    ("Clipboard", "round_trips_unicode", 150),
    ("PathHandling", "normalizes_separators", 200),
];

#[derive(Debug, Parser)]
#[command(
    name = "variant-rates",
    about = "Emit the same tests under several variants, each with its own failure rate."
)]
struct Args {
    #[command(flatten)]
    common: CommonArgs,

    #[arg(long, env = "SYNTH_VARIANT_RATE_LINUX", default_value = "3")]
    rate_linux: u8,

    #[arg(long, env = "SYNTH_VARIANT_RATE_MACOS", default_value = "34")]
    rate_macos: u8,

    #[arg(long, env = "SYNTH_VARIANT_RATE_WINDOWS", default_value = "12")]
    rate_windows: u8,

    #[arg(
        long,
        env = "SYNTH_VARIANTS",
        value_delimiter = ',',
        default_value = "linux,macos,windows"
    )]
    variants: Vec<String>,
}

fn weighted_rate(variant_rate: u8, weight_percent: u32) -> u8 {
    let scaled = u32::from(variant_rate) * weight_percent / 100;
    scaled.clamp(1, 100) as u8
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

        let mut healthcheck_rng =
            StoryRng::derive_with(STORY_ID, bucket, &format!("{variant}#healthcheck"));
        spec.push(TestCaseSpec::new(
            TestIdentity::in_suite(STORY_ID, "Healthcheck", "variant_generator_is_reporting"),
            Outcome::Pass,
            durations.draw(&mut healthcheck_rng, Outcome::Pass),
        ));

        let mut failures = 0;
        for (suite, name, weight) in CASES {
            let mut rng =
                StoryRng::derive_with(STORY_ID, bucket, &format!("{variant}#{suite}#{name}"));
            let weighted = weighted_rate(rate, *weight);
            let outcome = if rng.chance(weighted) {
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
                    "synthetic failure on the {variant} variant at {weighted}% \
                     ({weight}% of the variant's {rate}% rate)"
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
