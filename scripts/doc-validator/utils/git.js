/**
 * Git Utility Functions
 */

import { execSync, execFileSync } from 'node:child_process'

function normalizeAndValidateBranch(baseBranch = 'main') {
    const normalizedBaseBranch = baseBranch && baseBranch.trim() ? baseBranch.trim() : 'main'
    // Keep branch refs strict to avoid shell/meta injection and invalid refs.
    if (!/^[A-Za-z0-9._/-]+$/.test(normalizedBaseBranch) || normalizedBaseBranch.startsWith('-')) {
        throw new Error(`Invalid base branch: ${normalizedBaseBranch}`)
    }
    return normalizedBaseBranch
}

/**
 * Get list of changed files relative to a specified branch
 * @param {string} baseBranch - Base branch name (default 'main')
 * @param {string} pattern - File pattern filter (default '*.md')
 * @returns {Array<string>} List of changed file paths
 */
export function getChangedFiles(baseBranch = 'main', pattern = '*.md') {
    const normalizedBaseBranch = normalizeAndValidateBranch(baseBranch)
    const remoteRef = `origin/${normalizedBaseBranch}`

    // Ensure getting the latest remote branch information
    try {
        execFileSync('git', ['fetch', 'origin', normalizedBaseBranch], { stdio: 'pipe' })
    } catch (e) {
        // If fetch fails, continue using local branch
        console.warn(`Warning: Could not fetch ${remoteRef}, using local branch`)
    }

    // Get changed files
    let output
    try {
        output = execFileSync('git', ['diff', '--name-only', `${remoteRef}...HEAD`], { encoding: 'utf-8' })
    } catch (error) {
        throw new Error(`Failed to diff against ${remoteRef}: ${error.message}`)
    }

    // Filter files
    const files = output
        .split('\n')
        .filter(file => file.trim())
        .filter(file => file.endsWith('.md'))

    return files
}

/**
 * Get current branch name
 * @returns {string} Current branch name
 */
export function getCurrentBranch() {
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf-8'
        }).trim()
        return branch
    } catch (error) {
        console.error('Error getting current branch:', error.message)
        return 'unknown'
    }
}

/**
 * Check if inside a git repository
 * @returns {boolean} Whether inside a git repository
 */
export function isGitRepository() {
    try {
        execSync('git rev-parse --git-dir', { stdio: 'pipe' })
        return true
    } catch (error) {
        return false
    }
}

/**
 * Get git diff content of a file
 * @param {string} filePath - File path
 * @param {string} baseBranch - Base branch
 * @returns {string} diff content
 */
export function getFileDiff(filePath, baseBranch = 'main') {
    try {
        const normalizedBaseBranch = normalizeAndValidateBranch(baseBranch)
        const remoteRef = `origin/${normalizedBaseBranch}`
        const diff = execFileSync('git', ['diff', `${remoteRef}...HEAD`, '--', filePath], { encoding: 'utf-8' })
        return diff
    } catch (error) {
        console.error(`Error getting diff for ${filePath}:`, error.message)
        return ''
    }
}

export default {
    getChangedFiles,
    getCurrentBranch,
    isGitRepository,
    getFileDiff
}