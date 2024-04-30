cd src/package
python3 -m build
pip3 install dist/dataplexutils_metadata_wizard-0.0.1.tar.gz
cp dist/dataplexutils_metadata_wizard-0.0.1.tar.gz ../backend_apis/
cd ../..