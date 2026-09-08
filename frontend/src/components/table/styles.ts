/**
 * The Bst-Table stylesheets, imported once for the whole app.
 *
 * Order is load order and it is a contract: the engine's neutral defaults, then the adapter's
 * shadcn skin over them, then `bst-table.css` re-pointing the adapter's variables at the app's
 * theme tokens. This is the ONLY module that imports these three — a second importer could land
 * after it in the graph and displace the theme bridge, so every table pulls the styles from
 * here (`import '@/components/table/styles'`) rather than importing the CSS directly.
 */
import '@bloomskill/table-engine/styles.css'
import '@bloomskill/table-shadcn/styles.css'
import '@/components/table/bst-table.css'
