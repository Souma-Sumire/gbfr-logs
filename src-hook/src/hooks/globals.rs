use std::ptr;
use std::sync::atomic::{AtomicPtr, AtomicU32};

use anyhow::{Context, Result};

use crate::hooks::ffi::QuestState;
use crate::process::Process;

pub static QUEST_STATE_PTR: AtomicPtr<QuestState> = AtomicPtr::new(ptr::null_mut());
pub static PLAYER_DATA_OFFSET: AtomicU32 = AtomicU32::new(0);
pub static WEAPON_OFFSET: AtomicU32 = AtomicU32::new(0);
pub static OVERMASTERY_OFFSET: AtomicU32 = AtomicU32::new(0);
pub static SIGIL_OFFSET: AtomicU32 = AtomicU32::new(0);
pub static SBA_OFFSET: AtomicU32 = AtomicU32::new(0);

pub fn setup_globals(_process: &Process) -> Result<()> {
    PLAYER_DATA_OFFSET.store(0x5E60, std::sync::atomic::Ordering::Relaxed);
    SIGIL_OFFSET.store(0x8AA0, std::sync::atomic::Ordering::Relaxed);
    WEAPON_OFFSET.store(0x8B58, std::sync::atomic::Ordering::Relaxed);
    OVERMASTERY_OFFSET.store(0x8BD8, std::sync::atomic::Ordering::Relaxed);
    SBA_OFFSET.store(0x53D0, std::sync::atomic::Ordering::Relaxed);



    Ok(())
}
