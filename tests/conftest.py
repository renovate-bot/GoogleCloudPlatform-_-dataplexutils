#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
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
"""
"""Dataplex Utils Metadata Wizard test suite configuration
   2024 Google
"""
import pytest


def pytest_addoption(parser):
    parser.addoption("--project_id", action="store", default="Project id")
    parser.addoption("--llm_location", action="store", default="LLM location")
    parser.addoption("--dataplex_location", action="store", default="Dataplex location")
    parser.addoption("--documentation_uri", action="store", default="PDF Uris")


@pytest.fixture(scope="session")
def project_id(request):
    project_id_value = request.config.option.project_id
    if project_id_value is None:
        pytest.skip()
    return project_id_value


@pytest.fixture(scope="session")
def llm_location(request):
    llm_location_value = request.config.option.llm_location
    if llm_location_value is None:
        pytest.skip()
    return llm_location_value


@pytest.fixture(scope="session")
def dataplex_location(request):
    dataplex_location_value = request.config.option.dataplex_location
    if dataplex_location_value is None:
        pytest.skip()
    return dataplex_location_value


@pytest.fixture(scope="session")
def documentation_uri(request):
    documentation_uri_value = request.config.option.documentation_uri
    if documentation_uri_value is None:
        pytest.skip()
    return documentation_uri_value
