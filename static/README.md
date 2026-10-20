# Browser assets

This directory owns public assets for the MARS browser host. The application uses the file/edit/navigation SVGs, favicon, and license from this directory; modern debugger and display glyphs are rendered by the Venus toolbar component. Assets added here should serve an existing MARS interface responsibility; they must not depend on the legacy resource directory at runtime.

The [icons](icons/) are hand-authored SVG equivalents of the corresponding 22-pixel toolbar and memory-navigation rasters in [images](../_legacy-app/images/). Each keeps the legacy basename without its size suffix, names its source in its header, and includes the original MIT notice. They use vector geometry rather than embedded raster data; their symbols and colors follow the desktop controls, with simplified small details. This is not a claim of pixel-identical conversion. The prepared set covers New, Open, Save, SaveAs, Dump, Print, Undo, Redo, Cut, Copy, Paste, Find, Assemble, Play, StepForward, StepBack, Pause, Stop, Reset, Help, Previous, and Next. The other legacy illustrations and tools' imagery are not converted yet.

[favicon.ico](favicon.ico) is an unchanged copy of [images/mars.ico](../_legacy-app/images/mars.ico), as requested. The original desktop title-bar image is separately credited to NASA/JPL in [VenusUI.java](../_legacy-app/mars/venus/VenusUI.java). Preserve that credit when using the Mars imagery in the application About content. The bundled [MARS license](MARSlicense.txt) accompanies these copied and adapted assets and is served unchanged as a plain-text file. Help → About MARS opens it in a new tab while keeping the IDE session open.

Use the SVGs as external images with an empty `alt` when the containing button supplies its accessible label; an icon alone must not be the only description of an action. Render at the legacy 22-pixel toolbar size initially. If an SVG is later inlined more than once, replace its local title ID with a unique component ID. Do not introduce inline raster payloads or remote resource references.

The [GUI port mapping](../docs/gui-port.md) records the source owners, initial desktop layout, remaining work, and browser adaptations.

Preparation checks parsed all 22 SVGs as XML and confirmed their view boxes, titles, and absence of raster image or script elements. Byte comparisons confirmed the favicon and bundled license match their sources. The source rasters were visually inspected, but a browser/SVG renderer was unavailable; rendered appearance, accessibility integration, and application behavior remain unverified.
