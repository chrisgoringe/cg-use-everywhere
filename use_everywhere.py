class classproperty(object):
    def __init__(self, f):
        self.f = f
    def __get__(self, obj, owner):
        return self.f(owner)

class UseEverywhere():
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{},
                "optional": { x.lower() : (x, {}) for x in s.RETURN_TYPES }
                }
    FUNCTION = "func"
    CATEGORY = "everywhere"
    OUTPUT_NODE = True

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

class SeedEverywhere():
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{ "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}) }}
    OUTPUT_NODE = True

    RETURN_TYPES = ("INT",)
    FUNCTION = "func"
    CATEGORY = "everywhere"

    def func(self, seed):
        return (seed,)

try:
    from custom_nodes.cg_custom_core.ui_decorator import ui_signal
    @ui_signal('display_text')
    class AnythingEverywhere(UseEverywhere):
        @classmethod
        def INPUT_TYPES(s):
            return {"required":{}, 
                    "optional": { 
                        "anything" : ("*", {}), 
                        } }

        RETURN_TYPES = ()

        def func(self, anything=None, **kwargs):
            return (str(anything),)
        
    @ui_signal('display_text')
    class AnythingSomewhere(UseEverywhere):
        @classmethod
        def INPUT_TYPES(s):
            return {"required":{}, 
                    "optional": { 
                        "anything" : ("*", {}), 
                        "title" : ("STRING", {"default":".*"}),
                        "input" : ("STRING", {"default":".*"}),
                        } }

        RETURN_TYPES = ()

        def func(self, anything=None, **kwargs):
            return (str(anything),)
except:
    pass