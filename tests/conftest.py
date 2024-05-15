#!/usr/bin/env python
# -*- coding: utf-8 -*-

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
