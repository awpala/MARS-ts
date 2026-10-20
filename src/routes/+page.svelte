<script lang="ts">
	import VenusUI from '#lib/venus/VenusUI.svelte';
</script>

<svelte:head>
	<meta
		name="description"
		content="A browser-based MIPS IDE for writing, assembling, running, and debugging MIPS assembly programs."
	/>
	<meta name="application-name" content="MARS" />
	<meta name="keywords" content="MARS, MIPS, assembler, simulator, IDE, debugger, assembly language" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="MARS — MIPS Assembler and Runtime Simulator" />
	<meta
		property="og:description"
		content="A browser-based MIPS IDE for writing, assembling, running, and debugging MIPS assembly programs."
	/>
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="MARS — MIPS Assembler and Runtime Simulator" />
	<meta
		name="twitter:description"
		content="A browser-based MIPS IDE for writing, assembling, running, and debugging MIPS assembly programs."
	/>
</svelte:head>

<!-- @component Opens the main MARS desktop directly with a session owned by VenusUI. -->
<VenusUI />
