import toml
import pkgutil

# Load constants from constants.toml located in the same package
constants = toml.loads(pkgutil.get_data(__package__, "constants.toml").decode())

class ClientOptions:
    """Represents the client options for the metadata wizard client."""
    def __init__(
        self,
        use_lineage_tables=False,
        use_lineage_processes=False,
        use_profile=False,
        use_data_quality=False,
        use_ext_documents=False,
        persist_to_dataplex_catalog=True,
        stage_for_review=False,
        add_ai_warning=True,
        use_human_comments=False,
        regenerate=False,
        top_values_in_description=True,
        description_handling=constants["DESCRIPTION_HANDLING"]["APPEND"],
        description_prefix=constants["OUTPUT_CLAUSES"]["AI_WARNING"]
    ):
        self._use_lineage_tables = use_lineage_tables
        self._use_lineage_processes = use_lineage_processes
        self._use_profile = use_profile
        self._use_data_quality = use_data_quality
        self._use_ext_documents = use_ext_documents
        self._persist_to_dataplex_catalog = persist_to_dataplex_catalog
        self._stage_for_review = stage_for_review
        self._add_ai_warning = add_ai_warning
        self._use_human_comments = use_human_comments
        self._regenerate = regenerate
        self._top_values_in_description = top_values_in_description
        self._description_handling = description_handling
        self._description_prefix = description_prefix 