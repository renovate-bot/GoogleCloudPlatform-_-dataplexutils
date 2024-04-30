#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Dataplex Utils Metadata Wizard test suite configuration
   2024 Google
"""
import pytest


def pytest_addoption(parser):
    parser.addoption("--project_id", action="store", default="Project id")
    parser.addoption("--location", action="store", default="Project location")


@pytest.fixture(scope='session')
def project_id(request):
    project_id_value = request.config.option.project_id
    if project_id_value is None:
        pytest.skip()
    return project_id_value


@pytest.fixture(scope='session')
def location(request):
    location_value = request.config.option.location
    if location_value is None:
        pytest.skip()
    return location_value
