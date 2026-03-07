import styles from './styles.module.css'
import { Navbar } from './navbar'
 
export default function NetToolsLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
        <>
        <Navbar />
        <section className={styles.nettools}>{children}</section>
        </>
)
}
