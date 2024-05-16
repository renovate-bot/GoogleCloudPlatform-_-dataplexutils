from setuptools import setup

setup(
    name="metadata_wizard",
    version="0.1",
    install_requires=[
        "requests",
    ],
    packages=["metadata_wizard_cli"],
    entry_points={"console_scripts": ["metadata_wizard=metadata_wizard_cli.cli:main"]},
)
