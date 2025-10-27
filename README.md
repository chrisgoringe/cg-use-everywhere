# UE Nodes

## Love this node? 

[Buy me a coffee!](https://www.buymeacoffee.com/chrisgoringe)

## Shameless plug

Check out [Image Picker](https://github.com/chrisgoringe/cg-image-filter) for another way to make some workflows smoother.

# Recent Changes

If upgrading from before version 7, see the end of this document for the major changes in v7.

<details>
<summary>Changes since 7.0</summary>

## 7.4

- Added broadcasting from [any node](#any-node-broadcasting)
- Added negative regex option

## 7.3

Bugfixes: 
[361](https://github.com/chrisgoringe/cg-use-everywhere/issues/361), 
[379](https://github.com/chrisgoringe/cg-use-everywhere/issues/379), 
[381](https://github.com/chrisgoringe/cg-use-everywhere/issues/381)

## 7.2.1 and 7.2.2

Bugfixes: 
[383](https://github.com/chrisgoringe/cg-use-everywhere/issues/383), 
[384](https://github.com/chrisgoringe/cg-use-everywhere/issues/384), 
[388](https://github.com/chrisgoringe/cg-use-everywhere/issues/388)

## 7.2

- Added support for [Combo inputs](#combo-clone) via the `Combo Clone` helper node
- Fixed a number of issues related to subgraphs
- Improved handling of disconnect
- Added new options for handling multiple inputs of same type
- Added internationalisation options

## 7.1

- Allowed individual inputs to block UE connections
- Added support for multiple inputs of the same type
- Fixed a number of minor subgraph issues
- Fixed a serious bug with UE on Safari [details](https://github.com/chrisgoringe/cg-use-everywhere/issues/359)

</details>

# What is Anything Everywhere?

The `Anything Everywhere` node takes one or more inputs and sends the data to other nodes that need it. 
You can connect as many inputs to an `Anything Everywhere` node as you like, and there are a range of ways
to control where the data will be sent.

Here's the standard ComfyUI template modified to use `AnythingEverywhere`

|workflow|output image you can drop into Comfy|
|-|-|
|![simple](docs/simple-example.png)|![simple](docs/simple-example-image.png)|

The `MODEL`, `CLIP`, and `VAE` are automatically broadcast to all the places they are needed.

Doesn't make much difference in this simple case, but with complex workflows it really does.
This is what the default wan 2.2 s2v video workflow looks like:

|before|after|
|-|-|
|![before](docs/before.png)|![after](docs/after.png)|

# Any node broadcasting

<details>
<summary>New in version 7.4 - any node can broadcast itas outputs</summary>

As of version `7.4`, any node can be set to broadcast with `Add UE broadcasting` in the right-click menu. I find this really helpful for subgraphs especially.

When broadcasting, the node acts like all its outputs were connected to a single UE node, so

|This...|...does the same as this|
|-|-|
|![with](docs/broadcaston.png)|![without](docs/broadcastoff.png)|
</details>

# Where will the data be sent?

The key to using Anything Everywhere nodes is understanding where the data will be sent.

By default the data will be sent to any input of the same data type which does not have a connection, 
and does not have a widget providing the value.

<details>
<summary>
At the receiving end: you can specify that an input should not accept data, or that one with a widget should.
</summary>

In the `UE Connectable Inputs` menu (right-click on a node): 
the green bar indicates an input is connectable. The `Reject UE links` option can be used to make this node completely reject UE links, regardless of other settings.

![uec](docs/connectable.png)
</details>

<details>
<summary>
At the sending end, you can constrain where the data gets send through  restrictions applied to the `Anything Everywhere` node. 
</summary>

Restrictions can be accessed by double-clicking the body of the node, or through the right-click menu.

![restrictions](docs/restrictions.png)

The first three entries are [regex](https://regex101.com/) patterns. 
The node will only send data to another node if the regex matches the receiving node title, the name of the input, or the name of a group the receiving node is in, respectively. Check the 'invert' checkbox to invert the regex (send only to things which _don't_ match).

The Group and Colour restrictions will constrain the node to only send to nodes in (or not in) the same group, and of the same (or different) colour.

If you select multiple restrictions, all must be satisfied for the node to send.

If any restrictions are applied, the `Anything Everywhere` node gets a green circle in the top left hand corner, and a tooltip if you hover the mouse over it (as long as Show Links is not set to None).

`Repeated Types` determines behaviour when more than one input of the same type is connected to an `Anything Everywhere` node.
In this case an additional constraint is used to disambiguate which inputs match 
by comparing the name of the input slot on the `Anything Everywhere` node with 
either the name of the input slot on the target node, or the name of the target node.
The `match start` and `match end` options require that the input names match from the start (or end) for the full length of the shorter: 
so you can match `seed` to `seed` or `noise_seed` by naming the `Anything Everywhere` input `seed` and selecting `Match end of input names`.

You can rename input slots by right-clicking on the input dot - but you can't rename widget inputs - this is a limitation imposed by ComfyUI ([discussion](https://github.com/Comfy-Org/ComfyUI_frontend/issues/3654)). The work-around is to rename the target node (or use multiple `Anything Everywhere` nodes with other constraints, especially color matching).

`String to Combos` (default `no`) can be used to allow a `STRING` input to be sent to a `COMBO` widget. Since there may be a lot of combo widgets, this should be used with care - you will almost certainly want to use other restrictions (such as an `input regex`, or the `Repeated Types` constraint with multiple strings (eg `sampler_name` and `scheduler`)). *No validation takes place* to ensure that the string sent is one of the combo options!

You are probably better off using the `Combo Clone` [helper node](#special-case-nodes)

</details>

<details>
<summary>
What if two or more `Anything Everywhere` nodes can send to the same input? How are conflicts resolved?
</summary>

Each node has an automatically calculated priority - in general the more restrictive the node, the higher the priority.
You can see this prority in the restrictions dialog, and you can choose to replace the automatically calculated value if you wish.

If two more more `Anything Everywhere` nodes match the same input, the higher priority node is used. If there is a tie, _no connection is made_.
When there is a tie, if you right-click on the canvas you will find an option to show which nodes are the problem.

</details>

# Visual Clues

Anything Everywhere has a number of ways to help you visualise what it is doing.

<details>
<summary>Show Anything Everywhere links</summary>

If you want to see the UE links, you can turn them on and off by right-clicking on the canvas. For finer control, the main settings menu has options to show links when the mouse moves over the node at either end, or when one of those nodes is selected.

The links can be animated to distinguish them from normal links - this animation can take the form of moving dots, a pulsing glow, or both. This may impact performance in some cases - note that the pulse animation requires less processing than the moving dots. Control this in the main settings menu. 

Animation takes quite a lot of processing, so don't use it unless you really need to. By default the animations turn off when the workflow is running to minimise impact on CPU/GPU - you can change this in the settings too.
</details>

<details>
<summary>Nodes that broadcast have a badge</summary>

Any node that is capable of broadcasting data (a UE node, or another node to which broadcasting has been added) is marked with a circle in the top left hand corner.

If the circle is green, the node has no additional restrictions on where data will be sent; 
if it is red, it has one or more restrictions (which you can see by hovering your mouse over it, or by editing restrictions 
with the option on the right click menu, or by double clicking the node).

If the node is actually sending data, the circle (red or green) is bold; if the node is capable of sending but is not actually making
and connections, it is muted.

![redgreen](docs/redgreen.png)
</details>

<details>
<summary>Inputs have a subtle visual clue</summary>

The state of inputs is also represented visually: a black ring and a glow on the input dot indicates it is connectable. 
In the image below, `positive` has been set to not accept UE inputs, `steps` has been set to accept them, and `model` has a UE connection.

![uec](docs/connectable2.png)

If a widget is getting data from a UE connection, it is grayed out, like `steps` below:

![uec](docs/connectable3.png)
</details>

# Special Case Nodes

<details>
<summary>To broadcast to COMBO (dropdown menu) widgets, you can either use String to Combos (above) or a Combo Clone</summary>

For each Combo type you want to use, add a Combo Clone node. Here we want to be able to broadcast `sampler_name` and `scheduler`.

![CC1](docs/ComboClone1.png)

Connect the `Combo Clone` output to a widget you want it to replicate. The `Combo Clone` copies the options from that widget, and the widget name.

![CC2](docs/ComboClone2.png)

Disconnect the `Combo Clone` and  connect it to an `Anything Everywhere` node. The name copying means you can connect multiple Combos to a single `Anything Everywhere` node.

![CC3](docs/ComboClone3.png)

It can now broadcast to any node with the same input type (but remember you will have to mark the Combo widget as UE Connectable, since widgets are not connectable by default). 

</details>

<details>
<summary>Prompts Everywhere handles a positive and a negative prompt</summary>


Prompt Everywhere has two inputs. They will be sent with regex matching rules designed to match `prompt` or `positive`, and `neg`, respectively.

The actual regexes used are `(_|\\b)pos(itive|_|\\b)|^prompt|正面` and `(_|\\b)neg(ative|_|\\b)|负面`

|strings|conditionings|
|-|-|
|![pe](docs/PE.png)|![pe](docs/conditioning.png)

</details>


<details>
<summary>Seed Everywhere, Anything Everywhere? and Anything Everywhere3 are deprecated and will be automatically replaced</summary>

The `Seed Everywhere` node will be replaced with a primitive int, set to broadcast, with an input regex restriction that matches the localised name of the `seed` input on the base `KSampler` node - `seed` or `随机种` being the most common.

The `Anything Everywhere?` node will be replaced with an `Anything Everywhere` node with restrictions.

The `Anything Everywhere3` node will be replaced with an `Anything Everywhere` node with multiple inputs and any appropriate restrictions.

These replacements should not break any workflows. If they do... sorry.

</details>


# Options

<details>
<summary>
In the main settings menu, you will find the Use Everywhere options:
</summary>

![options](docs/options.png)

The top set, `Graphics`, modify the visual appearance only. 

The bottom set, `Options`, modify behaviour:

- When connecting, use the output slot's name as the input name. When a new connection is made to a UE node, the default is to name the input with the type. Select this option to use the output name of the node the link is from.
- Block workflow validation. This prevents other nodes from complaining about the lack of connections, or creating them. If you turn this off, there may be unexpected consequences.
- Logging. Increase the logging level if you are asked to help debug.
- Connect to bypassed nodes. When off, Use Everywhere will not connect to a bypassed node, and will attempt to work out whether an input is connected when upstream nodes are bypassed. I recommend turning this on.

</details>

# Primitives and Reroutes

<details>
<summary>
UE nodes work with the new primitives added in more recent versions of Comfy (in the `primitive` submenu)
</summary>

![primitives](docs/primitives.png)

UE nodes do not work with the old-style `Primitive` nodes (which automatically determined what data type they needed to be),
nor do they work with reroute nodes.

In both cases that is dues to some issues that are deep within ComfyUI, related to the way that these nodes work out 
the data type they represent, which makes it next to impossible for UE to correctly intereact with them.

</details>

# Other features

<details>
<summary>
Third Party Integration - the UE API
</summary>

At the suggestion of [@fighting-tx](https://github.com/fighting-tx), 
I've added a method that third party nodes can use if they want to see the prompt as generated by UE. 
It's attached to the `app` object, so you can check if it is present and use it something like this:

```js
var prompt
if (app.ue_modified_prompt) {
  prompt = await app.ue_modified_prompt()
} else {
  prompt = await original_graphToPrompt.apply(app)
}
```

Other methods could be exposed if there is interest - raise an issue if you'd like to see something. 
</details>

<details>
<summary>
Convert to real links
</summary>

If you want to share a workflow without Anything Everywhere nodes being required, or to save an API version of a workflow, you can replace the virtual links created by Anything Everywhere nodes with real links (and remove the UE nodes).

This can be done for a single node by right-clicking on it and selecting `Convert to real links`, or for all UE nodes in a graph or subgraph by right-clicking the background and selecting `Convert all UEs to real links`.

</details>

# Subgraphs

Anything Everywhere works fairly well with the new subgraphs (and setting a subgraph to broadcast its outputs is very powerful!). 
A couple of caveats:

<details>
<summary>Data is only broadcast within a graph</summary>

Anything Everywhere will not make links from nodes in one graph into a different graph. So you cannot broadcast data into a subgraph, nor can you broadcast it out.

This is a deliberate design decision, reflecting the fundamental principle of subgraphs - that they are self contained. 
Data can only go in or out of a subgraph through its input and output panels. 
This sort of data isolation is a very good thing in terms of maintaining a workflow, and by working consistently with the expectated
behaviour of subgraphs it is far less like that future changes in the front end will break Anything Everywhere.

This is not open for discussion. There are plenty of better ways to achieve the same end.

An Anything Everywhere node in your main graph can send to the input of a subgraph node; 
you can also connect as Anything Everywhere node to one of the inputs inside a subgraph.

You can connect an output of the subgraph node to an Anything Everywhere node (or set the subgraph node to broadcast), 
but you can't broadcast data within the subgraph to its output panel (because of difficulties determining the type)
although this may change [issue 405](https://github.com/chrisgoringe/cg-use-everywhere/issues/405).

</details>

<details>

<summary>When you create a subgraph, Anything Everywhere nodes do their best...</summary>

There are three nodes involved in every UE link: 
- Source (the link sending the data), 
- Control (the UE node connected to the source), 
- Target (the node that is receiving the data as an input)

This is how those cases are treated:

|Support|Source|Control|Target||
|-|-|-|-|-|
|Yes|Graph|Graph|Graph|Nothing changes|
|Yes|Graph|Graph|Subgraph|The subgraph will have inputs for the data; in the subgraph the input panel is connected to the Target with a real link|
|No|Graph|Subgraph|Graph|Not supported|
|No*|Graph|Subgraph|Subgraph|Not supported|
|Yes|Subgraph|Graph|Graph|The subgraph will be connected to the Control|
|No|Subgraph|Graph|Subgraph|Not supported|
|Yes|Subgraph|Subgraph|Graph|The Source will be connected to the Control *and* the output panel in the subgraph, the output will be connected to the Target with a real link|
|Yes|Subgraph|Subgraph|Subgraph|All nodes will be connected in the subgraph as they were in the graph|

No* indicates a case that does not work, but might get implemented.

No indicates a case I'm unlikely ever to support

</details>

# Reporting a bug well

If there is a bug in Anything Everywhere, I want to fix it. 
But my ability to do so depends on the quality of the information I have.

Seriously, people submit bug reports which just say "It isn't working since I updated". 
Well, it's working for me, so I don't have any idea what your problem is.

Give me good information, and if I can reproduce the problem, there's a good chance I'll fix it (or suggest a work-around).

So if you have a problem, go to [the issues page](https://github.com/chrisgoringe/cg-use-everywhere/issues), 
click on `New Issue`, select, `Bug Report`, and fill in as much of the information as you can.

# Suggesting new features

Go to [the issues page](https://github.com/chrisgoringe/cg-use-everywhere/issues), 
click on `New Issue`, select, `Feature Request`, and tell me your idea. 
If you can explain why the feature would be helpful to you, and ideally to others, I'm 
much more likely to think about whether it's possible.

# Thanks to 

The following people have contributed code or helpful discussions, without which these nodes would be less good!

- [DrJKL](https://github.com/DrJKL)
- [fighting-tx](https://github.com/fighting-tx)
- [huchenlei](https://github.com/huchenlei)
- [fichas](https://github.com/fichas)
- [LukeG89](https://github.com/LukeG89)
- [set-soft](https://github.com/set-soft)
- [TinyTerra](https://github.com/TinyTerra)
- [bananasss00](https://github.com/bananasss00)
- [JorgeR81](https://github.com/JorgeR81)

Feel free to [make suggestions, or implement features](https://github.com/chrisgoringe/cg-use-everywhere/issues) to get your name added here!

---

# Anything Everywhere v7

Version 7 is a major update to the Anything Everywhere nodes, so the documentation below is all new. If you are looking for the old docs, you can find them [here](https://github.com/chrisgoringe/cg-use-everywhere/README-old).

<details>
<summary>Major changes in v7</summary>

If you used Anything Everywhere prior to v7, the major improvements are:

- The `Anything Everywhere3` and `Anything Everywhere?` nodes are deprecated, as their features are now part of the standard `Anything Everywhere` node.
- `Anything Everywhere` nodes now have dynamic inputs, so you can plug as many different things into them as you like.
- All the restrictions on what nodes data will be sent to are now in a restrictions editor, that can be accessed through the right click menu of the node, or by double-clicking the body of the node.
  - In the restrictions editor you can set title, input, and group regexes, color restrictions, group restrictions, and priority (for when two nodes both match)
  - The green circle is used to indicate that _any_ restrictions are in place; if you hover over a node with restrictions they will appear in a tooltip
- Subgraphs are supported (in the majority of cases). Yay subgraphs! Seriously, they are _so_ much better than group nodes.
  - There are lots of odd cases with subgraphs, so if you find a case not covered properly, please [raise an issue](https://github.com/chrisgoringe/cg-use-everywhere/issues)

There are a couple of features that have been removed:

- Group nodes are no longer supported, as they are deprecated in ComfyUI in favour of the new subgraphs, which are supported (in most configurations)
- The `Simple String` mechanism to provide an input to the regex of an `Anything Everywhere?` node is no longer supported
  - Other UI mechanisms to address this need are under consideration

## Upgrade considerations

Other than the limitations noted, old workflows _should_ load and work out of the box, 
with `Anything Everywhere3` and `Anything Everywhere?` nodes automatically converted to `Anything Everywhere` nodes with the appropriate restrictions applied.

However, there may be edge cases that don't work; if you have any problems, please [raise an issue](https://github.com/chrisgoringe/cg-use-everywhere/issues).

You will _not_ be able to use workflows saved using v7 with older versions of ComfyUI or older versions of UE.

**Group Nodes are no longer supported**

</details>