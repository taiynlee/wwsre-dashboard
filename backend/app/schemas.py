from pydantic import BaseModel, Field


class SiteCreate(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    display_name: str = Field(min_length=1)
    country: str = Field(min_length=1)
    latitude: float
    longitude: float
    cluster_prefix: str = Field(min_length=1, max_length=16)
    enabled: bool = True


class SiteUpdate(BaseModel):
    display_name: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    cluster_prefix: str | None = Field(default=None, min_length=1, max_length=16)
    enabled: bool | None = None


class SiteOut(BaseModel):
    code: str
    display_name: str
    country: str
    latitude: float
    longitude: float
    cluster_prefix: str
    enabled: bool
    created_at: str
    updated_at: str


class SiteCategoryTargetIn(BaseModel):
    category: str = Field(min_length=1)
    target_pct: float = Field(gt=0, le=100)
    included: bool = True


class SiteCategoryTargetOut(SiteCategoryTargetIn):
    site_code: str
