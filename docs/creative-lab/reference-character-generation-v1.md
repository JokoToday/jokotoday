# Creative Lab — Reference + Character Generation v1

## Status

**IMPLEMENTATION CANDIDATE — FRONTEND + PREPARED EDGE FUNCTION**

This slice turns a Character project from a structured direction only into a production workspace with reusable source material, an explicit reference contract, candidate generation, and human review actions.

The frontend and Edge Function source are included in this change. The Edge Function is **not operational until separately deployed and configured with an `OPENAI_API_KEY` secret**. No secret, Supabase migration, RLS change, storage-bucket change, or production-data write is applied by this PR.

## Product principle

**CharacterSpec defines who the character is. Style Profile defines JOKO's visual language. Reference images have explicit, limited jobs.**

Creative Lab must not collapse into "upload an image + write a prompt". Human users and future agents should assemble the same structured production contract.

## Workflow

```text
Character Project
  → CharacterSpec
  → Source Material from Library
  → Reference role + fidelity + preserve contract
  → optional revision direction
  → Generate 3 candidates
  → Candidate Review
      → Approve as character master
      → Use as reference
      → Revise
      → Discard
```

## Source Material

A Character project can attach up to four existing Library Assets. The underlying Library asset keeps its own canonical classification, while its **use in this generation** gets a contextual reference role.

### Contextual reference roles

- Character identity
- Style / drawing language
- Clothing / appearance
- Pose / posture
- Object / prop
- Supporting reference

This distinction is intentional. One illustration may be a Character master in the Library and be used as a Character identity reference in one generation request. A different project could use the same asset only as a loose pose reference.

## Fidelity

JOKO-level semantic fidelity values are:

- Very close
- Recognizable
- Loose
- Inspiration

These are part of the Creative Package and are translated into provider instructions. They are not provider-specific API flags.

## Preserve contract

Each reference can explicitly preserve any combination of:

- face
- hair
- silhouette
- clothing
- expression
- props
- overall feel
- style

The purpose is to prevent reference leakage. A pose reference must not silently redefine Emma's face. A style reference must not silently import a different person's identity.

## Generation request

The human UI compiles a structured `CharacterGenerationRequest` containing:

- project ID
- complete CharacterSpec
- exact Style Profile and criteria
- ordered reference selections by stable Library asset ID
- role / fidelity / preserve metadata per reference
- optional revision note
- candidate count = 3
- output size = 1024×1536
- candidate quality = medium

The same request shape is suitable for future Hermes orchestration.

## Provider adapter v1

The prepared `generate-character-candidates` Supabase Edge Function is Admin-only and uses OpenAI's Image API server-side.

Default model:

`gpt-image-2.5-sunburst`

The model may be overridden server-side through `OPENAI_IMAGE_MODEL` without changing the Creative Lab contract.

When no image references are attached, the adapter calls the image generation endpoint. When references are attached, it calls the image edit endpoint with the ordered reference images. JOKO fidelity remains semantic prompt direction; it is not coupled to an OpenAI-specific fidelity control.

The API key remains server-side. The browser sends the authenticated generation request to the Edge Function and never receives or stores the provider credential.

## Candidate persistence in prototype

Generated candidate image data is returned to the authenticated browser and stored in the same IndexedDB Library used by Library Upload v1.

Generated candidate Library Assets carry:

- source = `creative-lab-generation`
- role = `Character candidate`
- subject/entity name
- Style Profile
- provider/model provenance
- originating project ID
- source reference asset IDs
- candidate/approved status

Approving a candidate in v1 changes its browser-local Library role to `Character master` and marks its generation status approved. This remains a prototype approval, not a persistent canonical Supabase character record.

## Activation boundary

After code review and merge, actual generation requires a separately approved operational step:

1. configure `OPENAI_API_KEY` as a Supabase Edge Function secret
2. optionally configure `OPENAI_IMAGE_MODEL`
3. deploy `generate-character-candidates`
4. verify Admin authorization and one low-risk candidate batch

The normal `jokotoday-deploy` frontend release does not by itself activate a Supabase Edge Function.

## Deferred

Not included in v1:

- persistent Supabase Creative Projects
- persistent canonical character/version tables
- DAM publishing workflow
- Scene generation
- Edit Existing mode
- provider multiplexing
- automated Style Guardian scoring
- public publishing
- cross-device Library synchronization

## Agent readiness

The intended future agent flow is:

```text
intent
→ retrieve CharacterSpec
→ search Library Assets
→ assign explicit reference roles
→ choose fidelity/preserve contract
→ submit CharacterGenerationRequest
→ receive candidate asset IDs
→ request human review
```

Human and agent interfaces therefore operate the same structured creative system rather than maintaining separate prompt workflows.
