from .use_everywhere import SeedEverywhere, AnythingEverywherePrompts
from typing import Any

UE_VERSION = "7.3"

NODE_CLASS_MAPPINGS:dict[str,Any] = { "Seed Everywhere": SeedEverywhere }

from .use_everywhere import AnythingEverywhere, AnythingSomewhere, AnythingEverywhereTriplet, SimpleString, ComboClone
NODE_CLASS_MAPPINGS["Anything Everywhere"] = AnythingEverywhere
NODE_CLASS_MAPPINGS["Anything Everywhere3"] = AnythingEverywhereTriplet
NODE_CLASS_MAPPINGS["Anything Everywhere?"] = AnythingSomewhere
NODE_CLASS_MAPPINGS["Prompts Everywhere"] = AnythingEverywherePrompts
NODE_CLASS_MAPPINGS["Simple String"] = SimpleString
NODE_CLASS_MAPPINGS["Combo Clone"] = ComboClone


WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
