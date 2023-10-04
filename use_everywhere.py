from custom_nodes.cg_custom_core.ui_decorator import ui_signal

class UseEverywhere():
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{},
                "optional": { x.lower() : (x, {}) for x in s.RETURN_TYPES }
                }
    FUNCTION = "func"
    CATEGORY = "everywhere/deprecated"
    OUTPUT_NODE = True
    RETURN_TYPES = ()

    def func(self, **kwargs):
        return tuple([kwargs.get(t.lower(),None) for t in self.RETURN_TYPES])   
    
class UseSomewhere(UseEverywhere):
    @classmethod
    def INPUT_TYPES(s):
        it = {"required":{},
                "optional": { x.lower() : (x, {}) for x in s.RETURN_TYPES }
                }
        it['optional']['title'] = ("STRING", {"default":".*"})
        it['optional']['input'] = ("STRING", {"default":".*"})
        return it

@ui_signal('display_text')
class SeedEverywhere():
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{ "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}) }}
    OUTPUT_NODE = True

    RETURN_TYPES = ("INT",)
    FUNCTION = "func"
    CATEGORY = "everywhere"

    def func(self, seed):
        return (seed, f"Seed : INT : {seed}",)

@ui_signal('display_text')
class AnythingEverywhere(UseEverywhere):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{}, 
                "optional": { "anything" : ("*", {}), } }

    CATEGORY = "everywhere"

    def func(self, **kwargs):
        for key in kwargs:
            return (f"{key} : {kwargs[key]}",)
        return ("unconnected",)
    
class AnythingEverywhereTriplet(UseEverywhere):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{}, 
                "optional": { "anything" : ("*", {}), "anything2" : ("*", {}), "anything3" : ("*", {}),} }
    
    CATEGORY = "everywhere"
    
    def func(self, **kwargs):
        return ()
    
@ui_signal('display_text')
class AnythingSomewhere(UseEverywhere):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{}, 
                "optional": { 
                    "anything" : ("*", {}), 
                    "title_regex" : ("STRING", {"default":".*"}),
                    "input_regex" : ("STRING", {"default":".*"}),
                    } }

    CATEGORY = "everywhere"

    def func(self, title_regex=None, input_regex=None, **kwargs):
        for key in kwargs:
            return (f"{key} : {kwargs[key]}",)
        return ("unconnected",)