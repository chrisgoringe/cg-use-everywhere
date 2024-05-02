# UE Nodes

Love this node? [Buy me a coffee!](https://www.buymeacoffee.com/chrisgoringe)

Getting started? Download the test workflow below and see how it works.

Problems? Jump down to [logging and debugging](https://github.com/chrisgoringe/cg-use-everywhere/blob/main/README.md#loggingdebugging)

Ideas for how to improve the nodes (or bug reports) - [raise an issue](https://github.com/chrisgoringe/cg-use-everywhere/issues)

Shameless plug for my other nodes -> Check out [Image Picker](https://github.com/chrisgoringe/cg-image-picker) for another way to make some workflows smoother. And leave a star if you like something!

---

## Test workflow

|This workflow uses all five nodes, and can be used to test (and understand!) the nodes. You wouldn't build it like this, it's just an example...|Here's an image with the workflow in|
|-|-|
|![screen](docs/test-workflow-screenshot.png)|![image](docs/test-workflow.png)|

Or [the workflow as json](docs/test-workflow.json)

## Current known limitations

There are some situations that UE nodes can't cope with at present. Here are some I know about, and possible workarounds.

### Pythonssss Preset Text

[pythonsssss](https://github.com/pythongosssss/ComfyUI-Custom-Scripts) custom nodes are great, but there are some limitations in using them with UE nodes. In particular, you can't feed the output of a Preset Text node directly into a UE node (see https://github.com/chrisgoringe/cg-use-everywhere/issues/154). 

### Group nodes

UE nodes mostly work with group nodes. But there are a couple of important things to note:

- when you create a group node the input names and node names can change. This might break UE? regex connections.

## Latest updates

4.9 (2nd May 2024)
- Fix incompatibility with Efficiency Nodes (#182)

4.8 (18th March 2024)
- Group and color sending have a `send to unmatched` mode
- UE link animations can be the classic dots, or a pulsing glow (or both, or neither)
- Show UE links can now be on, off, mouseover, selected nodes, or mouseover and selected nodes

4.7 (1st March 2024)
- UE now works in group nodes
- Autocomplete on `Anything Everywhere?` nodes

4.6
- add Group Regex to `Anything Everywhere?` node
- if you have workflow json files saved that now don't work, try 'workflow_fixer.py'

4.5
- add support for Comfy UI Group Nodes (UE nodes can be used to connect to group node inputs and outputs, but not within a group node)
- add `convert to real links`

4.4
- add (limited) support for converting regex in the `Anything Everywhere?` node with inputs (only works if the link is from a node that is a simple string source)

4.3
- added support for targetting [Highway nodes](https://github.com/chrisgoringe/cg-use-everywhere#highway-nodes) 

4.2
- improved performance of loop detection, especially with [highway nodes](https://github.com/Trung0246/ComfyUI-0246)
- updated docs to not use other custom nodes in examples

4.1.2
- tweaks to improve handling of bypass 
- fixed connecting to Seed Everywhere 

4.1.1
- added option to turn animation off

4.1 

- added [loop detection](https://github.com/chrisgoringe/cg-use-everywhere#loop-checking) 
- added [group restriction](https://github.com/chrisgoringe/cg-use-everywhere#group-restriction).

The v1 nodes have been fully removed. If you were using one, you can just replace it with an `Anything Everywhere` node.

## Installing

Use Comfy Manager. If you really want to do it manually, just clone this repository in your custom_nodes directory.

## Anything Everywhere (start here!)

The `Anything Everywhere` node has a single input, initially labelled 'anything'. Connect anything to it (directly - not via a reroute), and the input name changes to match the input type. Disconnect and it goes back to 'anything'.

When you run the prompt, any unconnected input, anywhere in the workflow, which matches that type, will act as if it were connected to the same input. 

To visualise what it's being connected to, right-click on the background canvas and select `Toggle UE Link Visibility`.

## Anything Everywhere? - control matching with regex rules

This node adds two widgets - title_regex and input_regex. It will only send to inputs which match. So in the example, title_regex is 'Preview' so the image is sent to the Preview Image node but not the Save Image node. Note that you can rename node and input titles, which can help! 

(From 4.6 you can also specify a group regex to only match inputs on nodes which are in groups that match the regex.)

![regex](docs/regex.png)

*The matches are regular expressions, not string matches.* Most simple strings will work (matching any part of the title or input name), but some characters have special meanings (including various sorts of brackets, ^, $, /, and . in particular) so just avoid them if you aren't regex-inclined.

Using regex means you can use `^prompt` to match `prompt` at the beginning of the title only, to avoid matching `negative_prompt`.

Regex 101 - `^` means 'the start', `$` means 'the end', `.` matches any single character, `.*` matches anything of any length (including zero). For more than that, visit [regex101](https://regex101.com/) (the flavour you want is ECMAScript, though that probably won't matter).

### Can I make the regex an input instead of a widget?

Sort of.

Because the regex needs to be known before the workflow is submitted (in order to calculate the links), you can't pass a string into the `Anything Everywhere?` node and expect it to work. The *only* thing that is supported is if the input comes *directly* from a node which sets it with a string widget. The `Simple String` node that is included in this pack will work. 

|This works|This doesn't. And never will.|
|-|-|
|![Alt text](docs/image.png)|![no](docs/imagex.png)|


## Seed Everywhere

Seed Everywhere connects to any unconnected INT input with `seed` in the input name (seed, noise_seed, etc), and it has the control_after_generate feature. So if you convert the seed widgets to inputs you can use the same seed everywhere.

## Anything Everywhere3 - One node, three inputs.

Really just three `Anything Everywhere` nodes packaged together.  Designed for the outputs of Checkpoint Loader. 

![UE3](docs/UE3.png)

## Prompts Everywhere - two strings or conditionings

Prompt Everywhere has two inputs. They will be sent with regex matching rules of `(^prompt|^positive)` and `neg` respectively. These should match the various versions of names that get used for prompts and negative prompts or conditionings.

|strings|conditionings|
|-|-|
|![pe](docs/PE.png)|![pe](docs/conditioning.png)

# Primitives and COMBOs and the like

UE nodes don't work with primitives and COMBOs (the data type used for dropdown lists, which are also a type of primitive within Comfy). It's unlikely they ever will. 

If you want to use UE to control sampler or sigma, you can do this with the built in `SamplerCustom` nodes:

![sample and sigma](docs/sampler%20and%20sigma.png)

For more on this, see [this discussion](https://github.com/chrisgoringe/cg-use-everywhere/issues/69)

# Other features

## Show links - visualisation and animation.

If you want to see the UE links, you can turn them on and off by right-clicking on the canvas. For finer control, the main settings menu has options to show links when the mouse moves over the node at either end, or when one of those nodes is selected.

The links can be animated to distinguish them from normal links - this animation can take the form of moving dots, a pulsing glow, or both. This may impact performance in some cases - note that the pulse animation requires less processing than the moving dots. Control this in the main settings menu.

By default the animations turn off when the workflow is running to minimise impact on CPU/GPU - you can change this in the settings too.

## Convert to real links

If you want to share a workflow without UE nodes being required, or to save an API version of a workflow, you can replace the virtual links created by UE nodes with real links (and remove the UE nodes).

This can be done for a single node by right-clicking on it and selecting `Convert to real links`, or for all UE nodes in a workflow by right-clicking the background and selecting `Convert all UEs to real links`.

## Shift drag

Shift click on an output node and drag then release to get an autocreate menu. This replaces the default behaviour (which gives you a search box), so you can disable it with the `Anything Everywhere replace search` setting.

![auto](docs/auto.gif)

## Group and color restriction

UE nodes can be restricted to send only to nodes of the same color, or only to nodes that *aren't* the same color.

They can also be restricted to send only to nodes in the same group (any group in common), or only to nodes that aren't in the same group.

Right-click on the node and select `Group restrictions` or `Color restrictions`. UE nodes which are restricted (in either or both ways) have a green circle in the top-left corner. 

## Highway nodes

Trung 0246's [Highway nodes](https://github.com/Trung0246/ComfyUI-0246) are a pretty cool way of piping data around. You can target them with an `Anything Everywhere?` node by using an `input_regex` which matches the unconnected input name with the '+', like this:
![highway](docs/highway.png)

This is new, so please report any issues!

## Loop checking

By default workflows are checked for loops before they are submitted (because UE can introduce them, and a loop results in a bad python outcome). If a loop is detected you'll get a JavaScript warning showing you the node ids involved. However, especially if there are other custom nodes involved, it's possible that the check will miss a loop, or flag one that isn't real.

If you get a warning and don't believe there is a loop (having checked the node ids listed!) you can turn loop checking off in the main settings menu. If something flagged as a loop runs fine, please [raise an issue](https://github.com/chrisgoringe/cg-use-everywhere/issues) and include the workflow in the report (save the json and zip it, because GitHub doesn't accept .json files). Likewise if a loop doesn't get caught.

I've written code for the core Comfy backend to catch loops, maybe it'll be included - [PR for ComfyUI](https://github.com/comfyanonymous/ComfyUI/pull/1652) - or maybe they have another plan.

## Priorities

If there is more than one sending node that matches an input, the basic rules is that the more specific node wins. The order of priorities is:

- `Anything Everywhere?` 
- `Seed Everywhere` and `Prompts Everywhere`
- `Anything Everywhere`
- `Anything Everywhere3`

For nodes of the same time, those with colour restrictions and group restriction are prioritised (colour+group > colour > group > none).

If two nodes with the same priority both match *neither will connect* - better to fail fast than have an ambiguous outcome. If there are ambiguous matches you can display them using `Show UE broadcast clashes` (right-click on background - the option only appears if there are clashes).

## See what is sent

The nodes which only have one output can also gain a text box showing exactly what passed through the node. You need to turn this on if you want it - it's in the main settings, 'Anything Everywhere node details'.

## Logging/Debugging

The JavaScript console (press f12 in some browsers) has logging information about what is being connected. You can change the level of detail by finding the file `[comfy_install]/custom_nodes/cg-use-everywhere/js/use_everywhre_utilities.js` and near the top finding this bit:
```javascript
    static ERROR       = 0; // actual errors
    static PROBLEM     = 1; // things that stop the workflow working
    static INFORMATION = 2; // record of good things
    static DETAIL      = 3; // details

    static LEVEL = Logger.PROBLEM;
    static TRACE = false;   // most of the method calls
```
Change the `LEVEL` to `Logger.INFORMATION` for more, or `Logger.DETAIL` for even more; set `TRACE` to `true` for some other debugging information.

If you have a problem, pressing f12 to see the JavaScript console can often help. The following steps are really helpful in making a good bug report:

- update to the latest version
- restart ComfyUI
- clear the canvas
- close the browser
- open a new Comfy window (with no workflow), look in console (f12) to see if there were any errors as ComfyUI started up
- load your workflow, and look again
- run, and look again

The other thing worth trying is clearing out all the custom node javascript from where it gets copied when ComfyUI starts:

- stop Comfy
- go to [comfy root]/web/extensions     (*not* under custom_nodes)
- remove everything there EXCEPT for `core`. Leave `core` (it's ComfyUI stuff)
- restart Comfy (all custom nodes will reinstall their javascript at startup)

If you find a bug, please [raise an issue](https://github.com/chrisgoringe/cg-use-everywhere/issues) - if you can include the workflow, that's a huge help (you'll need to save it as .txt, or zip the .json file, because GitHub doesn't accept .json).

## Cautions

Bypassing and disabling nodes works, but with one catch. If you have a UE nodes that does matching (`Anything Everywhere?` and `Prompt Everywhere`) and you bypass the node it matches to, the link won't be made. So

|If you use a ? node to send to a node...|...and bypass the recipient, it doesn't get connected |
|-|-|
|![1](docs/bypass_catch1.png)|![2](docs/bypass_catch2.png)|

This is unlikely to be fixed, but should be fairly easy to avoid!
