//! Shared library for the `synth/` generators.
//!
//! `synth/` fabricates JUnit XML for run histories that would otherwise take
//! weeks of wall clock to accumulate. Nothing here executes a test.
//!
//! Two properties are load-bearing, and every module in here exists to protect
//! one of them:
//!
//! 1. **Stable identity.** A test's identity in the product is derived from
//!    repository, file, classname, suite path, name, and variant. A single
//!    differing byte makes the product see a brand-new test instead of another
//!    run of an existing one, which would break every story in `synth/` —
//!    all of them depend on one test accumulating history. So identity is
//!    *derived*, never drawn from the RNG. See [`identity`].
//!
//! 2. **Determinism.** Seeds come from `hash(story_id, date_bucket)`, so the
//!    data looks random, reproduces exactly, and tells the same story in a fork
//!    as in the original. There is no unseeded randomness anywhere in this
//!    crate. See [`seed`].
//!
//! The RNG is used only for things that are *not* identity: outcomes,
//! durations, and message text.

pub mod attribution;
pub mod config;
pub mod identity;
pub mod manifest;
pub mod report;
pub mod seed;

pub use attribution::{Attribution, BranchClass, ProtectedBranches};
pub use config::CommonArgs;
pub use identity::TestIdentity;
pub use manifest::{Manifest, UploadEntry};
pub use report::{render, Outcome, ReportSpec, SuiteSpec, TestCaseSpec};
pub use seed::{fabricated_sha, stable_hash, DateBucket, StoryRng};
