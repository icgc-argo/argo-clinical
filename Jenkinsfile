@Library(value='jenkins-pipeline-library@master', changelog=false) _
pipelineRDPCClinical(
    buildImage: "node:18",
    dockerRegistry: "ghcr.io",
    dockerRepo: "icgc-argo/clinical",
    gitRepo: "icgc-argo/argo-clinical",
    testCommand: "npm ci && npm run unit-test && npm run int-test",
    helmRelease: "clinical"
)
