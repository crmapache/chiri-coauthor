import styles from './Kbd.module.scss'
import type { KbdProps } from './Kbd.types'

/** A keyboard key in running text: "Press <Kbd>Tab</Kbd> to accept". */
export const Kbd = ({ children }: KbdProps) => <kbd className={styles.kbd}>{children}</kbd>
