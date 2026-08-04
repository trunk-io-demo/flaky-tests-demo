//! Checks generated JUnit against the uploader's own validator.
//!
//! Well-formed XML is not the bar. The bar is that the uploader parses the
//! report, finds the fields test identity is derived from, and reports no
//! validation warnings — warnings look bad on screen mid-demo, and a field the
//! uploader silently ignores is a story that silently never appears.
//!
//! The uploader ships a `validate` subcommand that runs locally and uploads
//! nothing, so this can be a real test rather than a manual step. It is skipped
//! with a printed note when the binary is absent, because a local `cargo test`
//! should not require a download; CI provides it.
//!
//! Point `TRUNK_ANALYTICS_CLI` at the binary to run it:
//!
//! ```text
//! TRUNK_ANALYTICS_CLI=/path/to/trunk-analytics-cli cargo test -p junit-gen
//! ```

use std::process::Command;
use std::time::Duration;

use chrono::Utc;
use junit_gen::report::{write_report, Durations};
use junit_gen::{render, DateBucket, Outcome, ReportSpec, StoryRng, TestCaseSpec, TestIdentity};

/// Every outcome shape the generators can emit, in one report.
///
/// The report is stamped at *now*, not at a fixed date, because the uploader
/// warns on reports whose timestamps are more than an hour old. That constraint
/// is why `synth/` encodes a story's dates in test *names* and always stamps the
/// report itself at generation time — see `ReportSpec`.
fn sample_report() -> ReportSpec {
    let timestamp = Utc::now();
    let bucket = DateBucket::day_of(timestamp);
    let mut rng = StoryRng::derive("validate-fixture", bucket);
    let durations = Durations::default();

    let mut spec = ReportSpec::new("synth-validate-fixture", timestamp);
    for (suite, name, outcome) in [
        ("CheckoutFlow", "applies_promo_code", Outcome::Pass),
        ("CheckoutFlow", "rejects_expired_card", Outcome::Fail),
        ("CheckoutFlow", "skips_when_cart_empty", Outcome::Skip),
        (
            "CartTotals",
            "settles_after_retry",
            Outcome::PassAfterRetries { failures: 2 },
        ),
    ] {
        let duration = durations.draw(&mut rng, outcome);
        let mut case = TestCaseSpec::new(
            TestIdentity::in_suite("validate-fixture", suite, name),
            outcome,
            duration,
        );
        if matches!(outcome, Outcome::PassAfterRetries { .. }) {
            case = case.with_retry_duration(Duration::from_secs(30));
        }
        spec.push(case);
    }
    spec
}

#[test]
fn generated_junit_passes_the_uploaders_validator() {
    let Some(cli) = std::env::var_os("TRUNK_ANALYTICS_CLI") else {
        eprintln!(
            "skipping: set TRUNK_ANALYTICS_CLI to the uploader binary to validate generated JUnit"
        );
        return;
    };

    let dir = std::env::temp_dir().join(format!(
        "junit-gen-validate-{}-{}",
        std::process::id(),
        Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    let report = render(&sample_report());
    let path = write_report(&dir, "junit.xml", &report).expect("writes the report");

    let output = Command::new(&cli)
        .arg("validate")
        .arg("--junit-paths")
        .arg(&path)
        .output()
        .expect("runs the uploader's validator");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    std::fs::remove_dir_all(&dir).ok();

    assert!(
        output.status.success(),
        "validate failed\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}"
    );

    // Validation exits zero even when it reports problems, and those problems
    // are exactly the ones that make a story not arrive. The validator prefixes
    // each real warning with a marker, so its absence is the assertion — the
    // summary line mentions the word "warnings" either way.
    let combined = format!("{stdout}{stderr}");
    assert!(
        !combined.contains("⚠️"),
        "validator reported warnings\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}"
    );

    // And it parsed the structure we meant to emit, rather than finding an
    // empty report and calling it valid.
    assert!(
        combined.contains("2 test suites, 4 test cases"),
        "validator did not see the expected structure\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}"
    );
}
