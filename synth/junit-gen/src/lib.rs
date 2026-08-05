//! Shared library for the `synth/` generators. Nothing here executes a test.
//!
//! Two properties are load-bearing. Identity — repository, file, classname, suite,
//! name, variant — must be byte-identical across runs or the product sees a new
//! test instead of another run of an existing one, so identity is derived and
//! never drawn from the RNG. And seeds come from `hash(story, date_bucket)`, so a
//! fork reproduces the original exactly.

pub mod attribution;
pub mod config;
pub mod identity;
pub mod manifest;
pub mod report;
pub mod seed;

pub use attribution::{Attribution, AttributionBase, BranchClass, ProtectedBranches};
pub use config::CommonArgs;
pub use identity::TestIdentity;
pub use manifest::{Manifest, UploadEntry};
pub use report::{render, Outcome, ReportSpec, SuiteSpec, TestCaseSpec};
pub use seed::{fabricated_sha, stable_hash, DateBucket, StoryRng};
