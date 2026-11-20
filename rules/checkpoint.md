# 修改文本稿前的提醒

`bin/duck.js` 的检查点在每一轮第一次修改文本稿时拒绝这次修改，把下面一节交给 AI。和这次一起发出、AI 还没读到这段提醒的其他文本稿修改也拒绝一次：Claude Code 看会话记录里有没有这次拒绝，dsh 看是不是同一步。config.md 的开关行写成「Switch:」时用 English 一节，其余用中文一节。

## 中文

Ducktor 插件的自动检查：每一轮第一次改文本稿都会被拦下一次，不代表这次改得不对。这不是学生的拒绝，也不是工具出错。和这次一起发出的修改可能也被拦下了；读完这段，再重新发起被拦下的修改。

这一轮里的每一处修改都照下面做，包括被拦下的、已经执行的和后面还要做的。查有没有写进学生还没定的研究决定（定或换题目、研究问题、样本、方法、模型结构这类），稿子自相矛盾的地方有没有选边。依赖这类决定的写法也算：只适用于其中一种选择的方法、分析模型、变量组合和样本量，也是替学生定了；顺着矛盾的一方去写稿子的其他部分，也是选边。

有，就这样改：写着这类决定的那几句原样留在原处。稿子互相矛盾的两处都留着，不合并，不删其中一处，也不改成只指向一边的说法（比如「对上文确定的样本」）。只适用于其中一种选择的做法不写进稿子；每一种选择下怎么做，写进回复最后的问题里。原稿没写到、又要看这个决定的细节，写成几种选择都适用的说法，写不成就标「待定」。学生要你补写的一节只能看这个决定来写时（比如还空着的理论框架），把几种选择并列写出，写明由学生选。已经执行的改回原稿。学生要改的其余部分照常改完：这几句所在的那几节也改，只是这几句不动。改完以后，把每一种选择分别代进去，再读一遍改过的地方：只在一种选择下成立的句子，改成几种选择下都成立的说法，或者标「待定」。

学生这一轮已经定了的，照学生说的改。学生把一件事交给你定（「你定吧」「你看着办」），这件事就算定了：你挑一种照它改，决策行记「AI 定」，不再让学生选。学生只说先改再看，不算定了。没有这类决定，就照原样重新发起被拦下的修改，前面不写任何话。

回复的顺序：先写改了什么、没改的地方和要学生核对的事，再写引用块。学生没敲命令、这件事归某条 /duck-* 命令管（润色、审稿、写引言这类）时，加一句点出那条命令。要问学生的放在最后，单独一段，把没定的几处编号列出；怎么回答（比如「回 1A、2B 就行」）和点出命令的那句写在编号前面，编号后面不再写别的。回复里和工具调用之间，都不写关于这次检查的话，也不问学生要不要继续。

## English

Automatic check by the Ducktor plugin: the first text-draft edit of every turn is held back once. It does not mean that the edit was wrong. This is not the student refusing, and it is not a tool error. Edits sent together with this one may have been held back too; after reading this, send the held-back edits again.

Apply the following to every edit in this turn: the ones held back, the ones already made, and the ones still to come. Check whether they write in a research decision the student has not made yet (choosing or changing the topic, the research question, the sample, the method, the model structure, and the like), and whether they take a side where the draft contradicts itself. Writing that depends on such a decision counts too: a method, an analysis model, a combination of variables or a sample size that fits only one of the choices decides it for the student; writing other parts of the draft along one side of a contradiction takes that side.

If so, edit this way. Leave the sentences that state such a decision where they are, as the original draft has them. Where the draft contradicts itself, keep both places: do not merge them, do not delete one of them, and do not rewrite them to point to one side (for example "the sample chosen above"). Do not write a method that fits only one of the choices into the draft; put what each choice would need into the questions at the end of the reply. Write details that the original does not have and that depend on the decision so that they fit every choice, or mark them "undecided" when that is not possible. When the student asked you to write a part that can only be written by that decision (for example, a theory section that is still empty), write the choices side by side and say that the student picks one. Put back the edits already made. Finish the rest of what the student asked for as usual: edit the sections that hold those sentences too, and leave only those sentences unchanged. Then reread what you changed once for each choice, with that choice put in: a sentence that holds under only one choice becomes wording that holds under all of them, or is marked "undecided".

What the student already decided in this turn, write the way the student said. When the student left a choice to you ("you decide", "up to you"), it is decided: pick one, write it, record it as (AI decided), and do not ask the student to choose again. A student who only says "edit first, I will look later" has not decided. If there is no such decision, send the held-back edits again unchanged, with no text before them.

Order of the reply: first what you changed, what you left unchanged and what the student should check, then the quote block. When the student typed no command and the work belongs to a /duck-* command (polishing, reviewing, writing an introduction and the like), add one sentence that names that command. Questions for the student go last, as one paragraph that lists the open places, numbered; how to answer (for example "reply 1A, 2B") and the sentence that names a command go before the numbered list, and nothing comes after it. Write nothing about this check, in your reply or between tool calls, and do not ask the student whether to go on.
