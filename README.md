Copyright 2024 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

# Metadata Wizard

## Build solution

Build python package

```bash
src/package/build_install_package.sh
```

Try package on notebook located at `notebooks/metadata_wizard_demo.ipynb`

(Optional) Build service

```bash
src/backend_apis/build_deploy_cloud.sh
```

(Optional) Install CLI

```bash
src/cli/install_cli.sh
```

(Optional) Test frontend

```bash
src/frontend/metadata-wizard-app/build_local.sh
```
