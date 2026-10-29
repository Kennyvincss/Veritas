/**
 * EditProfileModal — inline modal for editing your own VERITAS profile.
 * Only accessible when the connected wallet matches the profile address.
 * Validates username uniqueness, URL safety, and sanitises all text fields.
 */

import { useState, useEffect, useRef } from 'react'
import { X, Camera, Globe, Twitter, Github, Loader2, Check, AlertCircle } from 'lucide-react'
import { useProfiles } from '@/hooks/useProfiles'
import { UserAvatar } from './UserAvatar'


interface EditProfileModalProps {
  address: string
  onClose: () => void
}

const SKILL_OPTIONS = [
  'Smart Contracts', 'Frontend Dev', 'Backend Dev', 'Design',
  'Security Audit', 'Documentation', 'Marketing', 'Community',
  'Data Analysis', 'DevOps', 'Mobile Dev', 'Research',
]

function isValidUrl(url: string): boolean {
  if (!url) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function EditProfileModal({ address, onClose }: EditProfileModalProps) {
  const { getProfile, saveProfile, getByUsername } = useProfiles()
  const existing = getProfile(address)

  const [displayName, setDisplayName] = useState(existing?.displayName ?? '')
  const [username, setUsername] = useState(existing?.username ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [website, setWebsite] = useState(existing?.website ?? '')
  const [twitter, setTwitter] = useState(existing?.twitterHandle ?? '')
  const [github, setGithub] = useState(existing?.githubHandle ?? '')
  const [skills, setSkills] = useState<string[]>(existing?.skills ?? [])
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(existing?.avatarDataUrl)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fileRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill].slice(0, 8),
    )
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500_000) {
      setErrors((prev) => ({ ...prev, avatar: 'Image must be under 500 KB.' }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      if (result.startsWith('data:image/')) {
        setAvatarPreview(result)
        setErrors((prev) => { const n = { ...prev }; delete n['avatar']; return n })
      }
    }
    reader.readAsDataURL(file)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs['displayName'] = 'Display name is required.'
    if (username && !/^[a-z0-9_]{3,20}$/.test(username.trim()))
      errs['username'] = 'Username: 3–20 chars, lowercase letters, numbers, underscores only.'
    if (username.trim()) {
      const taken = getByUsername(username.trim())
      if (taken && taken.address.toLowerCase() !== address.toLowerCase())
        errs['username'] = 'Username is already taken.'
    }
    if (website && !isValidUrl(website))
      errs['website'] = 'Enter a valid URL starting with https://'
    if (twitter && !/^[a-zA-Z0-9_]{1,15}$/.test(twitter.replace('@', '')))
      errs['twitter'] = 'Enter a valid Twitter/X handle.'
    if (github && !/^[a-zA-Z0-9-]{1,39}$/.test(github.replace('@', '')))
      errs['github'] = 'Enter a valid GitHub username.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    setSaving(true)

    const params = {
      address,
      displayName: displayName.trim().slice(0, 50),
      username: username.trim().toLowerCase().slice(0, 20),
      bio: bio.trim().slice(0, 400),
      skills,
      website: website.trim() || undefined,
      twitterHandle: twitter.trim().replace('@', '') || undefined,
      githubHandle: github.trim().replace('@', '') || undefined,
      avatarDataUrl: avatarPreview,
    }

    saveProfile(params, address)
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(26,46,74,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 8px 48px rgba(26,46,74,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="display font-700 text-lg" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <UserAvatar address={address} avatarUrl={avatarPreview} displayName={displayName} size={64} />
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-500 transition-colors"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Camera size={14} /> Upload photo
              </button>
              <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>JPG, PNG or GIF · max 500 KB</p>
              {errors['avatar'] && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors['avatar']}</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Display name */}
          <Field label="Display Name" required error={errors['displayName']}>
            <input
              type="text"
              value={displayName}
              maxLength={50}
              placeholder="Your name"
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
              style={{ borderColor: errors['displayName'] ? 'var(--danger)' : 'var(--border-strong)', background: 'var(--surface-muted)', color: 'var(--ink)' }}
            />
          </Field>

          {/* Username */}
          <Field label="Username" hint="3–20 chars · lowercase, numbers, underscores" error={errors['username']}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--subtle)' }}>@</span>
              <input
                type="text"
                value={username}
                maxLength={20}
                placeholder="yourname"
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                style={{ borderColor: errors['username'] ? 'var(--danger)' : 'var(--border-strong)', background: 'var(--surface-muted)', color: 'var(--ink)' }}
              />
            </div>
          </Field>

          {/* Bio */}
          <Field label="Bio" hint={`${bio.length}/400`}>
            <textarea
              value={bio}
              maxLength={400}
              rows={3}
              placeholder="Tell contributors about yourself…"
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-muted)', color: 'var(--ink)' }}
            />
          </Field>

          {/* Skills */}
          <div>
            <label className="block text-xs font-600 mb-2" style={{ color: 'var(--muted)' }}>
              Skills <span style={{ color: 'var(--subtle)' }}>(up to 8)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => {
                const active = skills.includes(skill)
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className="px-3 py-1.5 rounded-full text-xs font-500 border transition-all"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--surface-muted)',
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                      color: active ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {skill}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <label className="block text-xs font-600" style={{ color: 'var(--muted)' }}>Links</label>
            <LinkField
              icon={<Globe size={14} />}
              placeholder="https://yoursite.com"
              value={website}
              onChange={setWebsite}
              error={errors['website']}
            />
            <LinkField
              icon={<Twitter size={14} />}
              placeholder="@handle"
              value={twitter}
              onChange={setTwitter}
              error={errors['twitter']}
            />
            <LinkField
              icon={<Github size={14} />}
              placeholder="@username"
              value={github}
              onChange={setGithub}
              error={errors['github']}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border text-sm font-500 transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-600 transition-colors min-w-[100px] justify-center"
            style={{ background: saved ? 'var(--success)' : 'var(--accent)', color: '#fff', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-600" style={{ color: 'var(--muted)' }}>
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
        {hint && <span className="text-xs" style={{ color: 'var(--subtle)' }}>{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--danger)' }}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  )
}

function LinkField({
  icon,
  placeholder,
  value,
  onChange,
  error,
}: {
  icon: React.ReactNode
  placeholder: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }}>
          {icon}
        </span>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-8 pr-3 py-2.5 rounded-xl border text-sm outline-none"
          style={{ borderColor: error ? 'var(--danger)' : 'var(--border-strong)', background: 'var(--surface-muted)', color: 'var(--ink)' }}
        />
      </div>
      {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
