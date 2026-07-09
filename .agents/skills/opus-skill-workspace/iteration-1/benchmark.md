# Opus Skill — Iteration 1 Benchmark

## Summary

| Metric | With Skill | Without Skill | Delta |
|---|---|---|---|
| **Pass Rate** | 93.3% (14/15) | 86.7% (13/15) | +6.6% |
| **Avg Tokens** | 33,333 | 27,667 | +20.5% |
| **Avg Duration** | 33.3s | 27.7s | +20.5% |

## Per-Eval Breakdown

### Eval 1: CSV Processing Utility
| Assertion | With Skill | Without Skill |
|---|---|---|
| Error handling | ✅ | ✅ |
| Type hints | ✅ | ❌ |
| Separate concerns | ✅ | ✅ |
| Nested fields | ✅ | ✅ |
| Meaningful errors | ✅ | ✅ |
| **Pass rate** | **100%** | **80%** |

### Eval 2: Code Review Analysis
| Assertion | With Skill | Without Skill |
|---|---|---|
| Bearer prefix | ✅ | ✅ |
| jwt.verify error handling | ✅ | ✅ |
| Early return | ✅ | ✅ |
| JWT_SECRET check | ✅ | ✅ |
| Improved version | ✅ | ✅ |
| **Pass rate** | **100%** | **100%** |

### Eval 3: TypeScript Refactoring
| Assertion | With Skill | Without Skill |
|---|---|---|
| Separate layers | ✅ | ✅ |
| Age bug identified | ❌ | ❌ |
| Error handling | ✅ | ✅ |
| TypeScript types | ✅ | ✅ |
| Null safety | ✅ | ✅ |
| **Pass rate** | **80%** | **80%** |

## Analyst Observations

1. **Non-discriminating assertions**: The code review eval (eval 2) passed at 100% for both configurations. This eval doesn't differentiate between with/without skill — the issues in the auth middleware are well-known enough that the model catches them without prompting.

2. **Shared failure**: Both configurations miss the age calculation bug (year-only diff, not actual age). This is a genuine finding — the skill needs to explicitly instruct the model to look for subtle logic bugs like date math, not just structure/architecture issues.

3. **Key differentiator**: The type hints assertion (eval 1) is where the skill paid off — the skill's emphasis on type safety caused the with-skill run to add full type hints, while the baseline skipped them entirely.

4. **Token/duration cost**: The skill adds ~20% overhead in tokens and time, which is reasonable for the quality improvement.
