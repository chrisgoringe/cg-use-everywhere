
from comfy.comfy_types.node_typing import IO
from comfy_api.latest import io

anything = io.Custom(IO.ANY)

class ComboClone(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id  = "Combo Clone",
            category = "everywhere",
            display_name = "Combo Clone",
            description = "The combo on this node will replicate whatever the output is connected to",
            inputs   = [
                io.Combo.Input("combo", options=['connect me to a combo widget']),
            ],
            outputs = [
                anything.Output("comboout"),
            ],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool:
        return isinstance(kwargs.get('combo', None),str)

    @classmethod
    def execute(cls, combo): # type: ignore
        return io.NodeOutput(combo)

class SimpleString(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id  = "Simple String",
            category = "everywhere/deprecated",
            display_name = "Simple String",
            description = "Deprecated - use the core comfy string",
            is_deprecated = True,
            inputs   = [
                io.String.Input("string", default=""),
            ],
            outputs = [
                io.String.Output("stringout"),
            ],
        )

    @classmethod
    def execute(cls, string): # type: ignore
        return io.NodeOutput(string)

class SeedEverywhere(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id  = "Seed Everywhere",
            category = "everywhere/deprecated",
            display_name = "Seed Everywhere",
            description = "Deprecated - should automatically be replaced",
            is_deprecated = True,
            inputs   = [
                io.Int.Input("seed", default=0, min=0, max=0xffffffffffffffff),
            ],
            outputs = [
                io.Int.Output("int"),
            ],
        )
    
    @classmethod
    def execute(cls, seed): # type: ignore
        return io.NodeOutput(seed)

class AnythingEverywhere(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id  = "Anything Everywhere",
            category = "everywhere",
            display_name = "Anything Everywhere",
            inputs   = [
                anything.Input("anything", optional=True),
            ],
            outputs = [ ],
        )
    
    @classmethod
    def execute(cls, **kwargs): 
        return io.NodeOutput()

class AnythingEverywherePrompts(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id  = "Prompts Everywhere",
            category = "everywhere/deprecated",
            display_name = "Anything Everywhere Prompts", 
            description = "Deprecated - should automatically be replaced",
            is_deprecated = True,
            inputs   = [
                anything.Input("positive", display_name="+ve", optional=True),
                anything.Input("negative", display_name="-ve", optional=True),
            ],
            outputs = [ ],
        )
    
    @classmethod
    def execute(cls, **kwargs): 
        return io.NodeOutput()

class AnythingEverywhereTriplet(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id  = "Anything Everywhere3",
            category = "everywhere/deprecated",
            display_name = "Anything Everywhere Triplet", 
            description = "Deprecated - should automatically be replaced",
            is_deprecated = True,
            inputs   = [
                anything.Input("anything", display_name="anything", optional=True),
                anything.Input("anything2", display_name="anything2", optional=True),
                anything.Input("anything3", display_name="anything3", optional=True),
            ],
            outputs = [ ],
        )
    
    @classmethod
    def execute(cls, **kwargs): 
        return io.NodeOutput()
    
class AnythingSomewhere(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id  = "Anything Everywhere?",
            category = "everywhere/deprecated",
            display_name = "Anything Somewhere", 
            description = "Deprecated - should automatically be replaced",
            is_deprecated = True,
            inputs   = [
                anything.Input("anything", display_name="anything", optional=True),
                io.String.Input("title_regex", default="", optional=True),
                io.String.Input("input_regex", default="", optional=True),
                io.String.Input("group_regex", default="", optional=True),
            ],
            outputs = [ ],
        )
    
    @classmethod
    def execute(cls, **kwargs): 
        return io.NodeOutput()
    

