import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import { HomeIcon, ListIcon, WalletIcon, UploadIcon, GearIcon, TagIcon, LogoutIcon } from './icons'

const sidebarLinks = [
  { to: '/', label: 'Oversikt', end: true, Icon: HomeIcon },
  { to: '/transaksjoner', label: 'Transaksjoner', Icon: ListIcon },
  { to: '/kontoer', label: 'Kontoer', Icon: WalletIcon },
  { to: '/kategorier', label: 'Kategorier', Icon: TagIcon },
  { to: '/importer', label: 'Importer', Icon: UploadIcon },
  { to: '/innstillinger', label: 'Innstillinger', Icon: GearIcon },
]

const tabLinks = [
  { to: '/', label: 'Oversikt', end: true, Icon: HomeIcon },
  { to: '/transaksjoner', label: 'Transaksjoner', Icon: ListIcon },
  { to: '/kontoer', label: 'Kontoer', Icon: WalletIcon },
  { to: '/importer', label: 'Importer', Icon: UploadIcon },
  { to: '/innstillinger', label: 'Innstillinger', Icon: GearIcon },
]

export default function Layout() {
  const { profile, household, signOut } = useAuth()

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="row" style={{ marginBottom: 'var(--space-5)', padding: '0 var(--space-1)' }}>
          <Avatar src={household?.avatarUrl} name={household?.name} size="avatar-sm" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {household?.name}
            </div>
          </div>
        </div>

        {sidebarLinks.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <l.Icon width={18} height={18} />
            {l.label}
          </NavLink>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
          <div className="row" style={{ padding: '0 var(--space-1)', marginBottom: 'var(--space-2)' }}>
            <Avatar name={profile?.full_name} size="avatar-sm" />
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name}
            </div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={signOut}>
            <LogoutIcon width={16} height={16} />
            Logg ut
          </button>
        </div>
      </nav>

      <main className="app-main">
        <div className="page">
          <Outlet />
        </div>
      </main>

      <nav className="tab-bar">
        {tabLinks.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
            <l.Icon width={22} height={22} />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
