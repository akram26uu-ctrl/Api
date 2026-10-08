from pydantic import BaseModel


class FeatureDefinitionResponse(BaseModel):
    name: str
    value_type: str
    source: str
    description: str
    version: str
