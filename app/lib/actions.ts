'use server';

/**
 * By adding the 'use server', you mark all the exported functions within the file as server functions. 
 * These server functions can then be imported into Client and Server components, 
 * making them extremely versatile.
 * You can also write Server Actions directly inside Server Components by adding "use server" 
 * inside the action. But for this course, we'll keep them all organized in a separate file. 
 * */

//!Even if my form is client-side ('use client') this method will execute on the server

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod'; //TypeScript-first schema validation with static type inference

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// const FormSchema = z.object({
//     id: z.string(),
//     customerId: z.string(),
//     amount: z.coerce.number(),
//     status: z.enum(['pending', 'paid']),
//     date: z.string(),
// });

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
        .number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

// This is temporary until @types/react-dom is updated
export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    //prevState - contains the state passed from the useFormState hook. You won't be using it in the action 
    //in this example, but it's a required prop.
    console.log("I'm in the server! 😀")

    // const rawFormData = {
    //     customerId: formData.get('customerId'), //the id of the fields
    //     amount: formData.get('amount'),
    //     status: formData.get('status'),
    // };
    // Test it out:
    // console.log(rawFormData);
    // const { customerId, amount, status } = CreateInvoice.parse({
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        //console.log(validatedFields)
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }

    //Once the database has been updated, the /dashboard/invoices path will be revalidated, 
    //and fresh data will be fetched from the server.
    revalidatePath('/dashboard/invoices');

    redirect('/dashboard/invoices');
}



// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// ...

export async function updateInvoice(id: string, formData: FormData) {

    //This id comes in the bind: updateInvoice.bind(null, invoice.id)
    console.log("id :", id)
    console.log("formData :", formData)

    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    try {
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    } catch (error) {
        return { message: 'Database Error: Failed to Update Invoice.' };
    }

    /**
     * Note how redirect is being called outside of the try/catch block. This is because redirect works by 
     * throwing an error, which would be caught by the catch block. To avoid this, you can call redirect 
     * after try/catch. redirect would only be reachable if try is successful.
     */

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}



export async function deleteInvoice(id: string) {

    //Test
    throw new Error('Failed to Delete Invoice');

    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}