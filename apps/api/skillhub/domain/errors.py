from dataclasses import dataclass


class DomainError(Exception):
    """Base class for domain invariant failures."""


class NotFoundError(DomainError):
    """Raised when a referenced domain object does not exist."""


class InvariantError(DomainError):
    """Raised when a command would violate a domain rule."""


@dataclass(frozen=True)
class FieldError:
    """Machine-readable field error for API clients."""

    field: str
    message: str
    code: str

    def to_payload(self) -> dict[str, str]:
        return {"field": self.field, "message": self.message, "code": self.code}


class FieldInvariantError(InvariantError):
    """Raised when a domain rule can be mapped to one or more fields."""

    def __init__(self, detail: str, field_errors: list[FieldError]):
        super().__init__(detail)
        self.field_errors = field_errors


class PermissionDeniedError(DomainError):
    """Raised when an actor lacks permission for a protected action."""
