import type { ReactNode } from 'react'

import styles from './Kbd.module.scss'

/** A keyboard key in running text: "Press <Kbd>Tab</Kbd> to accept". */
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className={styles.kbd}>{children}</kbd>