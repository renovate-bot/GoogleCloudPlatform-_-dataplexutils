#!/bin/bash
# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Clean up old files
rm -rf dist/*
rm -rf *.egg-info

# Build new package
python3 -m build

# Install locally
pip3 install dist/dataplexutils_metadata_wizard-0.0.2.tar.gz

# Copy to backend
cp dist/dataplexutils_metadata_wizard-0.0.2.tar.gz ../backend_apis/
