[![StepSecurity Maintained Action](https://raw.githubusercontent.com/step-security/maintained-actions-assets/main/assets/maintained-action-banner.png)](https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions)

# github-action-matrix-outputs-write [![Latest Release](https://img.shields.io/github/release/step-security/github-action-matrix-outputs-write.svg)](https://github.com/step-security/github-action-matrix-outputs-write/releases/latest)

## Overview

This action implements a [workaround](https://github.com/community/community/discussions/17245#discussioncomment-3814009) for GitHub Actions' limitation with matrix job outputs.

It's 100% Open Source and licensed under the [APACHE2](LICENSE).












## Introduction

GitHub actions have an [Jobs need a way to reference all outputs of matrix jobs](https://github.com/community/community/discussions/17245) issue.
If there is a job that runs multiple times with `strategy.matrix` only the latest iteration's output availiable for 
reference in other jobs.

There is a [workaround](https://github.com/community/community/discussions/17245#discussioncomment-3814009) to address the limitation.
We implement the workaround with two GitHub Actions:
* [Matrix Outputs Write](https://github.com/step-security/github-action-matrix-outputs-write)
* [Matrix Outputs Read](https://github.com/step-security/github-action-matrix-outputs-read)

> step-security/github-action-matrix-outputs-write@v1+ is not currently supported on GHES yet.



## Usage



Example how you can use workaround to reference matrix job outputs.

```yaml
  name: Pull Request
  on:
    pull_request:
      branches: [ 'main' ]
      types: [opened, synchronize, reopened, closed, labeled, unlabeled]

  jobs:
    build:
      runs-on: ubuntu-latest
      strategy:
        matrix:
          platform: ["i386", "arm64v8"]
      steps:
        - name: Checkout
          uses: actions/checkout@v7

        - name: Build
          id: build
          uses: cloudposse/github-action-docker-build-push@v3
          with:
            registry: registry.hub.docker.com
            organization: "${{ github.event.repository.owner.login }}"
            repository: "${{ github.event.repository.name }}"
            build-args: |-
              PLATFORM=${{ matrix.platform }}

        ## Write for matrix outputs workaround 
        - uses: step-security/github-action-matrix-outputs-write@v1
          id: out
          with:
            matrix-step-name: ${{ github.job }}
            matrix-key: ${{ matrix.platform }}
            outputs: |-
              image: ${{ steps.build.outputs.image }}:${{ steps.build.outputs.tag }}
              ## Multiline string
              tags: ${{ toJson(steps.build.outputs.image) }}

    ## Read matrix outputs 
    read:
      runs-on: ubuntu-latest
      needs: [build]
      steps:
        - uses: step-security/github-action-matrix-outputs-read@v1
          id: read
          with:
            matrix-step-name: build

      outputs:
        result: "${{ steps.read.outputs.result }}"
  
    ## This how you can reference matrix output
    assert:
      runs-on: ubuntu-latest
      needs: [read]
      steps:
        - uses: nick-fields/assert-action@v4
          with:
            expected: ${{ registry.hub.docker.com }}/${{ github.event.repository.owner.login }}/${{ github.event.repository.name }}:i386
            ## This how you can reference matrix output
            actual: ${{ fromJson(needs.read.outputs.result).image.i386 }}
  
        - uses: nick-fields/assert-action@v4
          with:
            expected: ${{ registry.hub.docker.com }}/${{ github.event.repository.owner.login }}/${{ github.event.repository.name }}:arm64v8
            ## This how you can reference matrix output
            actual: ${{ fromJson(needs.read.outputs.result).image.arm64v8 }}
```

### Reusable workflow example 

Reusable workflow that support matrix outputs

`./.github/workflow/build-reusabled.yaml`

```yaml
name: Build - Reusable workflow
on:
  workflow_call:
    inputs:
      registry:
        required: true
        type: string
      organization:
        required: true
        type: string
      repository:
        required: true
        type: string
      platform:
        required: true
        type: string
      matrix-step-name:
        required: false
        type: string
      matrix-key:
        required: false
        type: string
    outputs:
      image:
        description: "Image"
        value: ${{ jobs.write.outputs.image }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Build
        id: build
        uses: cloudposse/github-action-docker-build-push@v3
        with:
          registry: ${{ inputs.registry }}
          organization: ${{ inputs.organization }}
          repository: ${{ inputs.repository }}
          build-args: |-
            PLATFORM=${{ inputs.platform }}
    outputs:
      image: ${{ needs.build.outputs.image }}:${{ needs.build.outputs.tag }}

  write:
    runs-on: ubuntu-latest
    needs: [build]
    steps:        
      ## Write for matrix outputs workaround 
      - uses: step-security/github-action-matrix-outputs-write@v1
        id: out
        with:
          matrix-step-name: ${{ inputs.matrix-step-name }}
          matrix-key: ${{ inputs.matrix-key }}
          outputs: |-
            image: ${{ needs.build.outputs.image }}

    outputs:
      image: ${{ fromJson(steps.out.outputs.result).image }}
      image_alternative: ${{ steps.out.outputs.image }}
```

Then you can use the workflow with matrix

```yaml
name: Pull Request
on:
  pull_request:
    branches: [ 'main' ]
    types: [opened, synchronize, reopened, closed, labeled, unlabeled]

jobs:
  build:
    usage: ./.github/workflow/build-reusabled.yaml
    strategy:
      matrix:
        platform: ["i386", "arm64v8"]
    with:
      registry: registry.hub.docker.com
      organization: "${{ github.event.repository.owner.login }}"
      repository: "${{ github.event.repository.name }}"
      platform: ${{ matrix.platform }}
      matrix-step-name: ${{ github.job }}
      matrix-key: ${{ matrix.platform }}

  ## Read matrix outputs 
  read:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: step-security/github-action-matrix-outputs-read@v1
        id: read
        with:
          matrix-step-name: build

    outputs:
      result: "${{ steps.read.outputs.result }}"

  ## This how you can reference matrix output
  assert:
    runs-on: ubuntu-latest
    needs: [read]
    steps:
      - uses: nick-fields/assert-action@v4
        with:
          expected: ${{ registry.hub.docker.com }}/${{ github.event.repository.owner.login }}/${{ github.event.repository.name }}:i386
          ## This how you can reference matrix output
          actual: ${{ fromJson(needs.read.outputs.result).image.i386 }}

      - uses: nick-fields/assert-action@v4
        with:
          expected: ${{ registry.hub.docker.com }}/${{ github.event.repository.owner.login }}/${{ github.event.repository.name }}:arm64v8
          ## This how you can reference matrix output
          actual: ${{ fromJson(needs.read.outputs.result).image.arm64v8 }}
```

or as a simple job

```yaml
name: Pull Request
on:
  pull_request:
    branches: [ 'main' ]
    types: [opened, synchronize, reopened, closed, labeled, unlabeled]

jobs:
  build:
    usage: ./.github/workflow/build-reusabled.yaml
    with:
      registry: registry.hub.docker.com
      organization: "${{ github.event.repository.owner.login }}"
      repository: "${{ github.event.repository.name }}"
      platform: "i386"

  ## This how you can reference single job output
  assert:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: nick-fields/assert-action@v4
        with:
          expected: ${{ registry.hub.docker.com }}/${{ github.event.repository.owner.login }}/${{ github.event.repository.name }}:i386
          ## This how you can reference matrix output
          actual: ${{ needs.build.outputs.image }}
```






<!-- markdownlint-disable -->

## Inputs

| Name | Description | Default | Required |
|------|-------------|---------|----------|
| matrix-key | Matrix key | N/A | false |
| matrix-step-name | Matrix step name | N/A | false |
| outputs | YAML structured map of outputs | N/A | false |


## Outputs

| Name | Description |
|------|-------------|
| result | Outputs result (Deprecated!!!) |
<!-- markdownlint-restore -->


## License

This project is licensed under the [Apache 2.0 License](LICENSE).



