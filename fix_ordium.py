import os

fixes_auth = {
    "api/app/routers/auth.py": [
        (
            # تحسين رسالة خطأ البريد المكرر
            '''user = db.query(User).filter(User.email == user_in.email).first()\n    if user:\n        raise HTTPException(status_code=400, detail="Email already registered")''',
            '''user = db.query(User).filter(User.email == user_in.email).first()\n    if user:\n        raise HTTPException(status_code=400, detail={"error": "email_exists", "message": "البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول."})'''
        ),
        (
            # تحسين خطأ انتهاء الجلسة
            '''raise credentials_exception''',
            '''raise HTTPException(\n            status_code=status.HTTP_401_UNAUTHORIZED,\n            detail={"error": "token_expired", "message": "انتهت صلاحية الجلسة، يرجى التحديث."},\n            headers={"WWW-Authenticate": "Bearer"},\n        )'''
        )
    ]
}

def apply_auth_patches():
    print("بدء تصحيح أخطاء المصادقة المنطقية...")
    for filepath, replacements in fixes_auth.items():
        if not os.path.exists(filepath):
            print(f"[تخطي] لم يتم العثور على: {filepath}")
            continue
            
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
            
        original_content = content
        
        for old_code, new_code in replacements:
            if old_code in content:
                content = content.replace(old_code, new_code)
                
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f"[نجاح] تم إصلاح تجربة المستخدم في: {filepath}")
        else:
            print(f"[بدون تغيير] الكود سليم أو معدل مسبقاً في: {filepath}")

if __name__ == "__main__":
    apply_auth_patches()