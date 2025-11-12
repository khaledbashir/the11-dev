# AI Project Instructions for Ongoing Work

## BUILD WORKFLOW
- **NEVER** build projects locally
- **ALL** builds must be done through Easypanel only
- No local building, testing, or compilation

## BRANCH STRATEGY
All code changes must be committed and pushed to the correct branch:

- **Front-end changes**: Push to `enterprise-grade-ux` branch
- **Back-end changes**: Push to `deb-backend` branch

## TESTING & VALIDATION
- **ALL** testing and validation take place on the Easypanel environment
- Do not test locally
- Do not validate changes locally

## LOG SOURCES
- Any logs provided are from the Easypanel instance
- **ONLY** refer to Easypanel logs for troubleshooting or status checks
- Do not use local logs or console output

## WORKFLOW COMPLIANCE
- **ALWAYS** follow this workflow without exception
- Do not deviate from these instructions
- Maintain consistency across all tasks

## POST-PUSH PROCEDURE
After every push, run: ` /root/the11-dev/cleanup-vps.sh`

## ENFORCEMENT
These instructions are mandatory and must be followed for all ongoing work in this project.
bash