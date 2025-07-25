import React from 'react'
import { Snackbar, Alert, Button } from '@mui/material'
import { TouchApp } from '@mui/icons-material'

interface IOSAudioPromptProps {
  open: boolean
  onAction: () => void
  message?: string
}

const IOSAudioPrompt: React.FC<IOSAudioPromptProps> = ({ 
  open, 
  onAction, 
  message = 'Tryk for at høre opgaven' 
}) => {
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: 4 }}
    >
      <Alert
        severity="info"
        icon={<TouchApp />}
        action={
          <Button color="inherit" size="small" onClick={onAction}>
            Tryk her for lyd
          </Button>
        }
        sx={{ 
          width: '100%',
          fontSize: '1.1rem',
          alignItems: 'center'
        }}
      >
        {message} 🔊
      </Alert>
    </Snackbar>
  )
}

export default IOSAudioPrompt