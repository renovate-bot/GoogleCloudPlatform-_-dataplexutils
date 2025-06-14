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

export PROJECT_ID="<TO_DO_DEVELOPER>"
export LLM_LOCATION="<TO_DO_DEVELOPER>"
export DATAPLEX_LOCATION="<TO_DO_DEVELOPER>"
export DOCUMENTATION_URI="<TO_DO_DEVELOPER>"


pytest tests/wizard_tests.py --project_id ${PROJECT_ID} --llm_location ${LLM_LOCATION} --dataplex_location ${DATAPLEX_LOCATION}
pytest tests/integration_tests.py --project_id ${PROJECT_ID} --llm_location ${LLM_LOCATION} --dataplex_location ${DATAPLEX_LOCATION}
pytest tests/cli_tests.py --project_id ${PROJECT_ID} --llm_location ${LLM_LOCATION} --dataplex_location ${DATAPLEX_LOCATION}